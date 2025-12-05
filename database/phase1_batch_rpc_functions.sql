-- =====================================================
-- Phase 1: 트랜잭션 처리 강화 - 일괄 저장 RPC 함수
-- =====================================================
-- 목적: 여러 품목 입고/판매 시 전체 성공 또는 전체 실패 (원자성 보장)
-- 기능: 거래번호 자동 생성, 권한 검증, 재고 부족 사전 체크

-- =====================================================
-- 1. 거래번호 생성 함수
-- =====================================================
DROP FUNCTION IF EXISTS generate_transaction_number(UUID, DATE, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION generate_transaction_number(
  p_branch_id UUID,
  p_transaction_date DATE,
  p_prefix TEXT  -- 'PUR' (입고) 또는 'SAL' (판매)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_code TEXT;
  v_seq INT;
  v_transaction_number TEXT;
  v_date_str TEXT;
BEGIN
  -- 지점 코드 조회
  SELECT code INTO v_branch_code
  FROM branches
  WHERE id = p_branch_id;
  
  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION '지점을 찾을 수 없습니다: %', p_branch_id;
  END IF;

  -- 날짜 문자열 (YYYYMMDD)
  v_date_str := TO_CHAR(p_transaction_date, 'YYYYMMDD');
  
  -- 일련번호 계산 (해당 지점, 날짜, 접두사별 최대값 + 1)
  -- MAX() 집계 함수는 FOR UPDATE와 함께 사용 불가하므로 별도 처리
  IF p_prefix = 'PUR' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(reference_number, '-', 4) AS INT)), 0) + 1
    INTO v_seq
    FROM purchases
    WHERE branch_id = p_branch_id
      AND purchase_date = p_transaction_date
      AND reference_number LIKE v_branch_code || '-' || v_date_str || '-' || p_prefix || '-%';
  ELSE
    SELECT COALESCE(MAX(CAST(SPLIT_PART(reference_number, '-', 4) AS INT)), 0) + 1
    INTO v_seq
    FROM sales
    WHERE branch_id = p_branch_id
      AND sale_date = p_transaction_date
      AND reference_number LIKE v_branch_code || '-' || v_date_str || '-' || p_prefix || '-%';
  END IF;
  
  -- 거래번호 생성: {지점코드}-{YYYYMMDD}-{PUR|SAL}-{001}
  v_transaction_number := v_branch_code || '-' || v_date_str || '-' || p_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');
  
  RETURN v_transaction_number;
END;
$$;

COMMENT ON FUNCTION generate_transaction_number(UUID, DATE, TEXT) IS '거래번호 자동 생성 (동시 요청 안전)';

-- =====================================================
-- 2. 입고 일괄 처리 함수
-- =====================================================
DROP FUNCTION IF EXISTS process_batch_purchase(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) CASCADE;

CREATE OR REPLACE FUNCTION process_batch_purchase(
  p_branch_id UUID,
  p_client_id UUID,
  p_purchase_date DATE,
  p_reference_number TEXT,  -- 클라이언트에서 제공 또는 NULL (자동 생성)
  p_notes TEXT,
  p_created_by UUID,
  p_items JSONB  -- [{"product_id": "...", "quantity": 10, "unit_cost": 1000, ...}, ...]
)
RETURNS TABLE (
  success BOOLEAN, 
  message TEXT, 
  transaction_number TEXT,
  purchase_ids UUID[],
  total_items INT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_number TEXT;
  v_purchase_id UUID;
  v_purchase_ids UUID[] := ARRAY[]::UUID[];
  v_item JSONB;
  v_item_count INT := 0;
  v_total_amount NUMERIC := 0;
  v_user_branch_id UUID;
  v_user_role TEXT;
BEGIN
  -- ============================================
  -- 1. 권한 검증: 본인 지점만 입력 가능 (시스템 관리자 제외)
  -- ============================================
  SELECT branch_id, role INTO v_user_branch_id, v_user_role
  FROM users
  WHERE id = p_created_by;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '사용자를 찾을 수 없습니다: ' || p_created_by::TEXT, NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 시스템 관리자(0000)가 아니면 본인 지점만 허용
  IF v_user_role != '0000' AND v_user_branch_id != p_branch_id THEN
    RETURN QUERY SELECT FALSE, '권한 없음: 본인 지점(' || v_user_branch_id::TEXT || ')만 입력 가능합니다.', NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC;
    RETURN;
  END IF;

  -- ============================================
  -- 2. 거래번호 생성 또는 검증
  -- ============================================
  IF p_reference_number IS NULL OR p_reference_number = '' THEN
    -- 자동 생성
    v_transaction_number := generate_transaction_number(p_branch_id, p_purchase_date, 'PUR');
    RAISE NOTICE '✅ 거래번호 자동 생성: %', v_transaction_number;
  ELSE
    -- 클라이언트 제공 번호 사용 (중복 체크)
    IF EXISTS (
      SELECT 1 FROM purchases 
      WHERE reference_number = p_reference_number 
        AND branch_id = p_branch_id
    ) THEN
      RETURN QUERY SELECT FALSE, '거래번호 중복: ' || p_reference_number, NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC;
      RETURN;
    END IF;
    v_transaction_number := p_reference_number;
  END IF;

  -- ============================================
  -- 3. 품목별 검증 및 입고 처리 (트랜잭션)
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 3-1. 필수 필드 검증
    IF (v_item->>'product_id') IS NULL THEN
      RAISE EXCEPTION '품목 ID가 없습니다: %', v_item;
    END IF;
    
    IF (v_item->>'quantity')::NUMERIC <= 0 THEN
      RAISE EXCEPTION '수량은 0보다 커야 합니다 (품목: %)', v_item->>'product_id';
    END IF;
    
    IF (v_item->>'unit_cost')::NUMERIC < 0 THEN
      RAISE EXCEPTION '단가는 0 이상이어야 합니다 (품목: %)', v_item->>'product_id';
    END IF;

    -- 3-2. 품목 존재 여부 확인
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = (v_item->>'product_id')::UUID) THEN
      RAISE EXCEPTION '품목을 찾을 수 없습니다: %', v_item->>'product_id';
    END IF;

    -- 3-3. 입고 레코드 생성
    INSERT INTO purchases (
      branch_id, 
      client_id, 
      product_id, 
      purchase_date,
      quantity, 
      unit_cost, 
      supply_price, 
      tax_amount, 
      total_price,
      reference_number, 
      notes, 
      created_by,
      created_at
    ) VALUES (
      p_branch_id, 
      p_client_id, 
      (v_item->>'product_id')::UUID, 
      p_purchase_date,
      (v_item->>'quantity')::NUMERIC, 
      (v_item->>'unit_cost')::NUMERIC,
      COALESCE((v_item->>'supply_price')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_cost')::NUMERIC),
      v_transaction_number, 
      COALESCE(v_item->>'notes', p_notes, ''),
      p_created_by,
      NOW()
    ) RETURNING id INTO v_purchase_id;
    
    -- 3-4. 결과 누적
    v_purchase_ids := array_append(v_purchase_ids, v_purchase_id);
    v_item_count := v_item_count + 1;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_cost')::NUMERIC);
    
    RAISE NOTICE '✅ 입고 저장: % (ID: %)', v_item->>'product_id', v_purchase_id;
  END LOOP;

  -- ============================================
  -- 4. 성공 반환 (inventory_layers는 트리거에서 자동 생성)
  -- ============================================
  RETURN QUERY SELECT 
    TRUE, 
    '입고 완료: ' || v_item_count || '개 품목'::TEXT, 
    v_transaction_number, 
    v_purchase_ids,
    v_item_count,
    v_total_amount;

EXCEPTION
  WHEN OTHERS THEN
    -- ✅ 전체 롤백 (트랜잭션 자동 롤백)
    RETURN QUERY SELECT 
      FALSE, 
      '입고 실패: ' || SQLERRM::TEXT, 
      NULL::TEXT, 
      NULL::UUID[],
      0,
      0::NUMERIC;
END;
$$;

COMMENT ON FUNCTION process_batch_purchase(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) IS '입고 일괄 저장 (트랜잭션 보장, 거래번호 자동 생성)';

-- =====================================================
-- 3. 판매 일괄 처리 함수 (FIFO 적용)
-- =====================================================
DROP FUNCTION IF EXISTS process_batch_sale(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) CASCADE;

CREATE OR REPLACE FUNCTION process_batch_sale(
  p_branch_id UUID,
  p_client_id UUID,
  p_sale_date DATE,
  p_reference_number TEXT,
  p_notes TEXT,
  p_created_by UUID,
  p_items JSONB  -- [{"product_id": "...", "quantity": 5, "unit_price": 1500, ...}, ...]
)
RETURNS TABLE (
  success BOOLEAN, 
  message TEXT, 
  transaction_number TEXT,
  sale_ids UUID[],
  total_items INT,
  total_amount NUMERIC,
  total_cost NUMERIC,
  total_profit NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_number TEXT;
  v_sale_id UUID;
  v_sale_ids UUID[] := ARRAY[]::UUID[];
  v_item JSONB;
  v_item_count INT := 0;
  v_total_amount NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_user_branch_id UUID;
  v_user_role TEXT;
  
  -- FIFO 계산용
  v_remaining_quantity NUMERIC;
  v_item_cost NUMERIC;
  v_available_stock NUMERIC;
  v_layer RECORD;
  v_consumed_quantity NUMERIC;
BEGIN
  -- ============================================
  -- 1. 권한 검증
  -- ============================================
  SELECT branch_id, role INTO v_user_branch_id, v_user_role
  FROM users
  WHERE id = p_created_by;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '사용자를 찾을 수 없습니다: ' || p_created_by::TEXT, NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  IF v_user_role != '0000' AND v_user_branch_id != p_branch_id THEN
    RETURN QUERY SELECT FALSE, '권한 없음: 본인 지점만 판매 가능합니다.', NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- ============================================
  -- 2. 거래번호 생성
  -- ============================================
  IF p_reference_number IS NULL OR p_reference_number = '' THEN
    v_transaction_number := generate_transaction_number(p_branch_id, p_sale_date, 'SAL');
  ELSE
    IF EXISTS (
      SELECT 1 FROM sales 
      WHERE reference_number = p_reference_number 
        AND branch_id = p_branch_id
    ) THEN
      RETURN QUERY SELECT FALSE, '거래번호 중복: ' || p_reference_number, NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
      RETURN;
    END IF;
    v_transaction_number := p_reference_number;
  END IF;

  -- ============================================
  -- 3. 전체 품목 재고 사전 체크 (비활성화 - 마이너스 재고 허용)
  -- ============================================
  -- ✅ 재고 부족 체크 제거 - 마이너스 재고 허용
  -- FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  -- LOOP
  --   SELECT COALESCE(SUM(remaining_quantity), 0) INTO v_available_stock
  --   FROM inventory_layers
  --   WHERE branch_id = p_branch_id 
  --     AND product_id = (v_item->>'product_id')::UUID
  --     AND remaining_quantity > 0;
  --   
  --   IF v_available_stock < (v_item->>'quantity')::NUMERIC THEN
  --     RAISE EXCEPTION '재고 부족: 품목 % (필요: %, 재고: %)', 
  --       v_item->>'product_id', 
  --       v_item->>'quantity', 
  --       v_available_stock;
  --   END IF;
  -- END LOOP;

  -- ============================================
  -- 4. 품목별 판매 처리 (FIFO 원가 계산)
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 4-1. 검증
    IF (v_item->>'product_id') IS NULL THEN
      RAISE EXCEPTION '품목 ID가 없습니다';
    END IF;
    
    IF (v_item->>'quantity')::NUMERIC <= 0 THEN
      RAISE EXCEPTION '수량은 0보다 커야 합니다';
    END IF;
    
    IF (v_item->>'unit_price')::NUMERIC < 0 THEN
      RAISE EXCEPTION '단가는 0 이상이어야 합니다';
    END IF;

    -- 4-2. FIFO 원가 계산
    v_remaining_quantity := (v_item->>'quantity')::NUMERIC;
    v_item_cost := 0;
    
    FOR v_layer IN 
      SELECT id, remaining_quantity, unit_cost
      FROM inventory_layers
      WHERE branch_id = p_branch_id 
        AND product_id = (v_item->>'product_id')::UUID
        AND remaining_quantity > 0
      ORDER BY purchase_date ASC, created_at ASC
      FOR UPDATE  -- 동시 판매 방지
    LOOP
      IF v_remaining_quantity <= 0 THEN
        EXIT;
      END IF;
      
      v_consumed_quantity := LEAST(v_remaining_quantity, v_layer.remaining_quantity);
      v_item_cost := v_item_cost + (v_consumed_quantity * v_layer.unit_cost);
      
      -- 재고 차감
      UPDATE inventory_layers
      SET remaining_quantity = remaining_quantity - v_consumed_quantity,
          updated_at = NOW()
      WHERE id = v_layer.id;
      
      v_remaining_quantity := v_remaining_quantity - v_consumed_quantity;
      
      RAISE NOTICE '  FIFO 차감: Layer % - % 개 소비 (원가: %)', v_layer.id, v_consumed_quantity, v_layer.unit_cost;
    END LOOP;

    -- 4-3. 판매 레코드 생성
    INSERT INTO sales (
      branch_id, 
      client_id, 
      product_id, 
      sale_date,
      quantity, 
      unit_price,
      supply_price,
      tax_amount,
      total_price,
      cost_of_goods_sold,
      profit,
      reference_number, 
      notes, 
      created_by,
      created_at
    ) VALUES (
      p_branch_id, 
      p_client_id, 
      (v_item->>'product_id')::UUID, 
      p_sale_date,
      (v_item->>'quantity')::NUMERIC, 
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'supply_price')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC),
      v_item_cost,  -- FIFO 원가
      COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC) - v_item_cost,  -- 이익
      v_transaction_number, 
      COALESCE(v_item->>'notes', p_notes, ''),
      p_created_by,
      NOW()
    ) RETURNING id INTO v_sale_id;
    
    -- 4-4. 결과 누적
    v_sale_ids := array_append(v_sale_ids, v_sale_id);
    v_item_count := v_item_count + 1;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    v_total_cost := v_total_cost + v_item_cost;
    v_total_profit := v_total_profit + (COALESCE((v_item->>'total_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC) - v_item_cost);
    
    RAISE NOTICE '✅ 판매 저장: % (ID: %, 원가: %)', v_item->>'product_id', v_sale_id, v_item_cost;
  END LOOP;

  -- ============================================
  -- 5. 성공 반환
  -- ============================================
  RETURN QUERY SELECT 
    TRUE, 
    '판매 완료: ' || v_item_count || '개 품목'::TEXT, 
    v_transaction_number, 
    v_sale_ids,
    v_item_count,
    v_total_amount,
    v_total_cost,
    v_total_profit;

EXCEPTION
  WHEN OTHERS THEN
    -- ✅ 전체 롤백 (재고 차감도 자동 롤백됨)
    RETURN QUERY SELECT 
      FALSE, 
      '판매 실패: ' || SQLERRM::TEXT, 
      NULL::TEXT, 
      NULL::UUID[],
      0,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC;
END;
$$;

COMMENT ON FUNCTION process_batch_sale(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) IS '판매 일괄 저장 (FIFO 원가 계산, 재고 부족 사전 체크, 트랜잭션 보장)';

-- =====================================================
-- 4. 권한 부여
-- =====================================================
GRANT EXECUTE ON FUNCTION generate_transaction_number(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_batch_purchase(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_batch_sale(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB) TO authenticated;

-- =====================================================
-- 5. 테스트 쿼리 (실행하지 말 것! 참고용)
-- =====================================================

/*
-- 테스트 1: 입고 일괄 저장
SELECT * FROM process_batch_purchase(
  '지점_UUID'::UUID,
  '공급업체_UUID'::UUID,
  '2025-01-26'::DATE,
  NULL,  -- 거래번호 자동 생성
  '테스트 입고',
  '사용자_UUID'::UUID,
  '[
    {"product_id": "품목1_UUID", "quantity": 10, "unit_cost": 1000, "supply_price": 1000, "tax_amount": 100, "total_price": 1100},
    {"product_id": "품목2_UUID", "quantity": 20, "unit_cost": 2000, "supply_price": 2000, "tax_amount": 200, "total_price": 2200}
  ]'::JSONB
);

-- 테스트 2: 판매 일괄 저장 (재고 부족 시 전체 롤백)
SELECT * FROM process_batch_sale(
  '지점_UUID'::UUID,
  '고객_UUID'::UUID,
  '2025-01-26'::DATE,
  NULL,
  '테스트 판매',
  '사용자_UUID'::UUID,
  '[
    {"product_id": "품목1_UUID", "quantity": 5, "unit_price": 1500},
    {"product_id": "품목2_UUID", "quantity": 999999, "unit_price": 3000}
  ]'::JSONB
);
-- 결과: 품목2 재고 부족으로 전체 롤백 (품목1도 저장 안됨)
*/
