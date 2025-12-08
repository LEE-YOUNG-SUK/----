-- ============================================
-- process_batch_sale 함수 수정 (거래번호 접두사 분리)
-- 작성일: 2025-01-26
-- 적용 완료: ✅ 실행됨 (정상 작동 중)
-- SALE → SAL, USAGE → USG
-- ============================================

CREATE OR REPLACE FUNCTION public.process_batch_sale(
  p_branch_id uuid, 
  p_client_id uuid, 
  p_sale_date date, 
  p_reference_number text, 
  p_notes text, 
  p_created_by uuid, 
  p_items jsonb, 
  p_transaction_type text DEFAULT 'SALE'::text
)
RETURNS TABLE(success boolean, message text, transaction_number text, sale_ids uuid[], total_items integer, total_amount numeric, total_cost numeric, total_profit numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_prefix TEXT;  -- ✅ 추가: 거래번호 접두사
  
  -- FIFO 계산용
  v_remaining_quantity NUMERIC;
  v_item_cost NUMERIC;
  v_available_stock NUMERIC;
  v_layer RECORD;
  v_consumed_quantity NUMERIC;
  
  -- 단가 및 이익 계산용
  v_unit_price NUMERIC;
  v_total_price NUMERIC;
  v_profit NUMERIC;
BEGIN
  
  -- ============================================
  -- 1. 권한 검증: 본인 지점만 입력 가능 (시스템 관리자 제외)
  -- ============================================
  SELECT branch_id, role INTO v_user_branch_id, v_user_role
  FROM users
  WHERE id = p_created_by;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '사용자를 찾을 수 없습니다: ' || p_created_by::TEXT, NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 시스템 관리자(0000)가 아니면 본인 지점만 허용
  IF v_user_role != '0000' AND v_user_branch_id != p_branch_id THEN
    RETURN QUERY SELECT FALSE, '권한 없음: 본인 지점(' || v_user_branch_id::TEXT || ')만 입력 가능합니다.', NULL::TEXT, NULL::UUID[], 0, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- ============================================
  -- 2. 거래번호 생성 (수동 입력 또는 자동 생성)
  -- ✅ 수정: USAGE는 'USG', SALE은 'SAL' 접두사 사용
  -- ============================================
  IF p_reference_number IS NULL OR TRIM(p_reference_number) = '' THEN
    -- ✅ 거래유형에 따른 접두사 결정
    IF p_transaction_type = 'USAGE' THEN
      v_prefix := 'USG';
    ELSE
      v_prefix := 'SAL';
    END IF;
    
    v_transaction_number := generate_transaction_number(p_branch_id, p_sale_date, v_prefix);
  ELSE
    v_transaction_number := p_reference_number;
  END IF;

  RAISE NOTICE '🛒 판매 일괄 처리 시작: 거래번호 %, 유형: %', v_transaction_number, p_transaction_type;

  -- ============================================
  -- 3. 품목별 처리 (FIFO 재고 차감 + 원가 계산)
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_remaining_quantity := (v_item->>'quantity')::NUMERIC;
    v_item_cost := 0;

    -- 재고 확인 (마이너스 재고 허용 - 경고만)
    SELECT COALESCE(SUM(remaining_quantity), 0)
    INTO v_available_stock
    FROM inventory_layers
    WHERE branch_id = p_branch_id
      AND product_id = (v_item->>'product_id')::UUID
      AND remaining_quantity > 0;

    IF v_available_stock <= 0 THEN
      RAISE WARNING '⚠️ 재고 없음: % (요청: %)', v_item->>'product_id', v_remaining_quantity;
    END IF;

    -- FIFO 방식으로 재고 차감 및 원가 누적
    FOR v_layer IN
      SELECT id, remaining_quantity, unit_cost
      FROM inventory_layers
      WHERE branch_id = p_branch_id
        AND product_id = (v_item->>'product_id')::UUID
        AND remaining_quantity > 0
      ORDER BY purchase_date ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_quantity <= 0;

      v_consumed_quantity := LEAST(v_layer.remaining_quantity, v_remaining_quantity);
      v_item_cost := v_item_cost + (v_consumed_quantity * v_layer.unit_cost);

      UPDATE inventory_layers
      SET remaining_quantity = remaining_quantity - v_consumed_quantity
      WHERE id = v_layer.id;

      v_remaining_quantity := v_remaining_quantity - v_consumed_quantity;
      
      RAISE NOTICE '  FIFO 차감: Layer % - % 개 소비 (원가: %)', v_layer.id, v_consumed_quantity, v_layer.unit_cost;
    END LOOP;

    -- ============================================
    -- 거래유형별 단가 및 이익 계산
    -- ============================================
    IF p_transaction_type = 'USAGE' THEN
      IF (v_item->>'quantity')::NUMERIC > 0 THEN
        v_unit_price := v_item_cost / (v_item->>'quantity')::NUMERIC;
      ELSE
        v_unit_price := 0;
      END IF;
      v_total_price := v_item_cost;
      v_profit := 0;
      
      RAISE NOTICE '📦 내부사용: 단가=%원 (FIFO 평균), 이익=0', v_unit_price;
    ELSE
      v_unit_price := (v_item->>'unit_price')::NUMERIC;
      v_total_price := COALESCE((v_item->>'total_price')::NUMERIC, v_unit_price * (v_item->>'quantity')::NUMERIC);
      v_profit := v_total_price - v_item_cost;
      
      RAISE NOTICE '💰 판매: 단가=%원 (입력), 이익=%원', v_unit_price, v_profit;
    END IF;

    -- ============================================
    -- 판매 레코드 생성
    -- ============================================
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
      created_at,
      transaction_type
    ) VALUES (
      p_branch_id, 
      p_client_id, 
      (v_item->>'product_id')::UUID, 
      p_sale_date,
      (v_item->>'quantity')::NUMERIC, 
      v_unit_price,
      COALESCE((v_item->>'supply_price')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      v_total_price,
      v_item_cost,
      v_profit,
      v_transaction_number, 
      COALESCE(v_item->>'notes', p_notes, ''),
      p_created_by,
      NOW(),
      p_transaction_type
    ) RETURNING id INTO v_sale_id;
    
    v_sale_ids := array_append(v_sale_ids, v_sale_id);
    v_item_count := v_item_count + 1;
    v_total_amount := v_total_amount + v_total_price;
    v_total_cost := v_total_cost + v_item_cost;
    v_total_profit := v_total_profit + v_profit;
    
    RAISE NOTICE '✅ 저장: % (ID: %, 원가: %, 이익: %)', v_item->>'product_id', v_sale_id, v_item_cost, v_profit;
  END LOOP;

  -- ============================================
  -- 5. 성공 반환
  -- ============================================
  RETURN QUERY SELECT 
    TRUE, 
    CASE 
      WHEN p_transaction_type = 'USAGE' THEN '내부사용 완료: ' || v_item_count || '개 품목'
      ELSE '판매 완료: ' || v_item_count || '개 품목'
    END::TEXT, 
    v_transaction_number, 
    v_sale_ids,
    v_item_count,
    v_total_amount,
    v_total_cost,
    v_total_profit;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      FALSE, 
      '처리 실패: ' || SQLERRM::TEXT, 
      NULL::TEXT, 
      NULL::UUID[],
      0,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC;
END;
$function$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION process_batch_sale(UUID, UUID, DATE, TEXT, TEXT, UUID, JSONB, TEXT) TO authenticated;

-- 확인
SELECT '✅ process_batch_sale 함수 수정 완료! (USAGE → USG 접두사)' AS status;

