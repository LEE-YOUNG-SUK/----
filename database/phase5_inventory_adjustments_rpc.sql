-- =====================================================
-- Phase 5-2: 재고 조정 RPC 함수
-- =====================================================
-- 목적: 재고 조정 처리 및 조회
-- 권한: 매니저 이상 (0000~0002)
-- Audit Log: RPC 함수에서 직접 INSERT

-- =====================================================
-- 1. process_inventory_adjustment() - 재고 조정 처리
-- =====================================================
CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_branch_id UUID,
  p_product_id UUID,
  p_adjustment_type TEXT,
  p_adjustment_reason TEXT,
  p_quantity NUMERIC,
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_supply_price NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_total_cost NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_adjustment_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  adjustment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adjustment_id UUID;
  v_username TEXT;
  v_branch_name TEXT;
  v_product_unit TEXT;
  v_current_stock NUMERIC;
  v_calculated_unit_cost NUMERIC;
BEGIN
  -- 1. 권한 검증 (매니저 이상: 0000~0002)
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RETURN QUERY SELECT false, '재고 조정 권한이 없습니다. (매니저 이상 필요)'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 2. 지점 격리 (시스템 관리자 제외)
  IF p_user_role != '0000' AND p_branch_id != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 재고만 조정할 수 있습니다.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 3. 조정 유형 검증
  IF p_adjustment_type NOT IN ('INCREASE', 'DECREASE') THEN
    RETURN QUERY SELECT false, '조정 유형은 INCREASE 또는 DECREASE여야 합니다.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 4. 조정 사유 검증
  IF p_adjustment_reason NOT IN ('STOCK_COUNT', 'DAMAGE', 'LOSS', 'RETURN', 'OTHER') THEN
    RETURN QUERY SELECT false, '올바른 조정 사유를 선택해주세요.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 5. 품목 정보 조회
  SELECT unit INTO v_product_unit
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '품목을 찾을 수 없습니다.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 6. 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = p_branch_id
  WHERE u.id = p_user_id;

  -- 7. INCREASE 검증: 원가 필수
  IF p_adjustment_type = 'INCREASE' AND (p_unit_cost IS NULL OR p_unit_cost <= 0) THEN
    RETURN QUERY SELECT false, '재고 증가 시 단위 원가는 필수입니다.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 8. DECREASE 검증: 현재 재고 확인
  IF p_adjustment_type = 'DECREASE' THEN
    SELECT COALESCE(SUM(remaining_quantity), 0)
    INTO v_current_stock
    FROM inventory_layers
    WHERE branch_id = p_branch_id 
      AND product_id = p_product_id
      AND remaining_quantity > 0;

    IF v_current_stock < p_quantity THEN
      RETURN QUERY SELECT 
        false, 
        format('재고 부족: 현재 재고 %s, 차감 요청 %s', v_current_stock, p_quantity)::TEXT,
        NULL::UUID;
      RETURN;
    END IF;
  END IF;

  -- 9. inventory_adjustments 레코드 생성
  INSERT INTO inventory_adjustments (
    branch_id,
    product_id,
    adjustment_type,
    adjustment_reason,
    quantity,
    unit,
    unit_cost,
    supply_price,
    tax_amount,
    total_cost,
    adjustment_date,
    notes,
    reference_number,
    created_by
  ) VALUES (
    p_branch_id,
    p_product_id,
    p_adjustment_type,
    p_adjustment_reason,
    p_quantity,
    v_product_unit,
    p_unit_cost,
    p_supply_price,
    p_tax_amount,
    p_total_cost,
    p_adjustment_date,
    p_notes,
    p_reference_number,
    p_user_id
  ) RETURNING id INTO v_adjustment_id;

  -- 10. inventory_layers 처리
  IF p_adjustment_type = 'INCREASE' THEN
    -- 재고 증가: 신규 레이어 추가
    INSERT INTO inventory_layers (
      branch_id,
      product_id,
      purchase_id,
      purchase_date,
      unit_cost,
      original_quantity,
      remaining_quantity,
      source_type,
      source_id
    ) VALUES (
      p_branch_id,
      p_product_id,
      NULL,  -- purchase_id는 NULL (조정)
      p_adjustment_date,
      p_unit_cost,
      p_quantity,
      p_quantity,
      'ADJUSTMENT',
      v_adjustment_id
    );

  ELSE  -- DECREASE
    -- 재고 감소: FIFO 방식으로 레이어 차감
    DECLARE
      v_layer_id UUID;
      v_layer_remaining NUMERIC;
      v_to_deduct NUMERIC := p_quantity;
      v_total_cost_sum NUMERIC := 0;
      v_quantity_sum NUMERIC := 0;
    BEGIN
      FOR v_layer_id, v_layer_remaining, v_calculated_unit_cost IN
        SELECT id, remaining_quantity, unit_cost
        FROM inventory_layers
        WHERE branch_id = p_branch_id
          AND product_id = p_product_id
          AND remaining_quantity > 0
        ORDER BY purchase_date ASC, created_at ASC
      LOOP
        IF v_to_deduct <= 0 THEN
          EXIT;
        END IF;

        IF v_layer_remaining >= v_to_deduct THEN
          -- 이 레이어에서 전부 차감 가능
          UPDATE inventory_layers
          SET 
            remaining_quantity = remaining_quantity - v_to_deduct,
            updated_at = NOW()
          WHERE id = v_layer_id;

          v_total_cost_sum := v_total_cost_sum + (v_to_deduct * v_calculated_unit_cost);
          v_quantity_sum := v_quantity_sum + v_to_deduct;
          v_to_deduct := 0;
        ELSE
          -- 이 레이어를 전부 사용하고도 부족
          UPDATE inventory_layers
          SET 
            remaining_quantity = 0,
            updated_at = NOW()
          WHERE id = v_layer_id;

          v_total_cost_sum := v_total_cost_sum + (v_layer_remaining * v_calculated_unit_cost);
          v_quantity_sum := v_quantity_sum + v_layer_remaining;
          v_to_deduct := v_to_deduct - v_layer_remaining;
        END IF;
      END LOOP;

      -- 계산된 평균 원가로 업데이트
      IF v_quantity_sum > 0 THEN
        UPDATE inventory_adjustments
        SET 
          unit_cost = v_total_cost_sum / v_quantity_sum,
          total_cost = v_total_cost_sum
        WHERE id = v_adjustment_id;
      END IF;
    END;
  END IF;

  -- 11. Audit Log 직접 기록
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    username,
    user_role,
    branch_id,
    branch_name,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    'inventory_adjustments',
    v_adjustment_id::TEXT,
    'INSERT',
    p_user_id::TEXT,
    v_username,
    p_user_role,
    p_branch_id::TEXT,
    v_branch_name,
    NULL,
    jsonb_build_object(
      'adjustment_type', p_adjustment_type,
      'adjustment_reason', p_adjustment_reason,
      'quantity', p_quantity,
      'unit_cost', p_unit_cost,
      'total_cost', p_total_cost
    ),
    ARRAY['adjustment_type', 'adjustment_reason', 'quantity', 'unit_cost', 'total_cost']
  );

  RETURN QUERY SELECT true, '재고 조정이 완료되었습니다.'::TEXT, v_adjustment_id;
END;
$$;

COMMENT ON FUNCTION process_inventory_adjustment IS '재고 조정 처리 (매니저 이상, FIFO 차감, Audit Log 직접 기록)';

-- =====================================================
-- 2. get_inventory_adjustments() - 조정 내역 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_inventory_adjustments(
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_adjustment_type TEXT DEFAULT NULL,
  p_adjustment_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  adjustment_type TEXT,
  adjustment_reason TEXT,
  quantity NUMERIC,
  unit_cost NUMERIC,
  supply_price NUMERIC,
  tax_amount NUMERIC,
  total_cost NUMERIC,
  adjustment_date DATE,
  notes TEXT,
  reference_number TEXT,
  created_by TEXT,
  created_by_username TEXT,
  created_at TIMESTAMPTZ,
  is_cancelled BOOLEAN,
  cancelled_by TEXT,
  cancelled_by_username TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 권한 검증 (매니저 이상)
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '재고 조정 조회 권한이 없습니다. (매니저 이상 필요)';
  END IF;

  RETURN QUERY
  SELECT 
    ia.id::TEXT,
    ia.branch_id::TEXT,
    b.name AS branch_name,
    ia.product_id::TEXT,
    p.code AS product_code,
    p.name AS product_name,
    ia.unit,
    ia.adjustment_type,
    ia.adjustment_reason,
    ia.quantity,
    ia.unit_cost,
    ia.supply_price,
    ia.tax_amount,
    ia.total_cost,
    ia.adjustment_date,
    ia.notes,
    ia.reference_number,
    ia.created_by::TEXT,
    u1.username AS created_by_username,
    ia.created_at,
    ia.is_cancelled,
    ia.cancelled_by::TEXT,
    u2.username AS cancelled_by_username,
    ia.cancelled_at,
    ia.cancel_reason
  FROM inventory_adjustments ia
  INNER JOIN branches b ON ia.branch_id = b.id
  INNER JOIN products p ON ia.product_id = p.id
  INNER JOIN users u1 ON ia.created_by = u1.id
  LEFT JOIN users u2 ON ia.cancelled_by = u2.id
  WHERE 
    -- 지점 격리 (시스템 관리자 제외)
    (p_user_role = '0000' OR ia.branch_id::TEXT = p_user_branch_id)
    -- 날짜 필터
    AND (p_start_date IS NULL OR ia.adjustment_date >= p_start_date)
    AND (p_end_date IS NULL OR ia.adjustment_date <= p_end_date)
    -- 유형 필터
    AND (p_adjustment_type IS NULL OR ia.adjustment_type = p_adjustment_type)
    -- 사유 필터
    AND (p_adjustment_reason IS NULL OR ia.adjustment_reason = p_adjustment_reason)
  ORDER BY ia.adjustment_date DESC, ia.created_at DESC
  LIMIT 1000;
END;
$$;

COMMENT ON FUNCTION get_inventory_adjustments IS '재고 조정 내역 조회 (매니저 이상, 지점 격리)';

-- =====================================================
-- 3. get_adjustment_summary() - 조정 통계
-- =====================================================
CREATE OR REPLACE FUNCTION get_adjustment_summary(
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_adjustments BIGINT,
  increase_count BIGINT,
  decrease_count BIGINT,
  total_increase_value NUMERIC,
  total_decrease_value NUMERIC,
  by_reason JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 권한 검증 (매니저 이상)
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '재고 조정 통계 조회 권한이 없습니다. (매니저 이상 필요)';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_adjustments,
    COUNT(*) FILTER (WHERE adjustment_type = 'INCREASE')::BIGINT AS increase_count,
    COUNT(*) FILTER (WHERE adjustment_type = 'DECREASE')::BIGINT AS decrease_count,
    COALESCE(SUM(total_cost) FILTER (WHERE adjustment_type = 'INCREASE'), 0) AS total_increase_value,
    COALESCE(SUM(total_cost) FILTER (WHERE adjustment_type = 'DECREASE'), 0) AS total_decrease_value,
    jsonb_object_agg(
      adjustment_reason,
      jsonb_build_object(
        'count', reason_count,
        'total_cost', reason_total_cost
      )
    ) AS by_reason
  FROM (
    SELECT 
      adjustment_type,
      adjustment_reason,
      total_cost,
      COUNT(*) OVER (PARTITION BY adjustment_reason) AS reason_count,
      SUM(total_cost) OVER (PARTITION BY adjustment_reason) AS reason_total_cost
    FROM inventory_adjustments
    WHERE 
      (p_user_role = '0000' OR branch_id::TEXT = p_user_branch_id)
      AND adjustment_date >= p_start_date
      AND adjustment_date <= p_end_date
      AND is_cancelled = false
  ) sub
  GROUP BY adjustment_type;
END;
$$;

COMMENT ON FUNCTION get_adjustment_summary IS '재고 조정 통계 (매니저 이상, 지점 격리)';

-- =====================================================
-- 4. cancel_inventory_adjustment() - 조정 취소
-- =====================================================
CREATE OR REPLACE FUNCTION cancel_inventory_adjustment(
  p_adjustment_id TEXT,
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_cancel_reason TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adjustment_branch_id UUID;
  v_adjustment_date DATE;
  v_adjustment_type TEXT;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_is_cancelled BOOLEAN;
  v_username TEXT;
  v_branch_name TEXT;
  v_old_data JSONB;
BEGIN
  -- 1. 권한 검증 (원장 이상만 취소 가능)
  IF p_user_role NOT IN ('0000', '0001') THEN
    RETURN QUERY SELECT false, '재고 조정 취소 권한이 없습니다. (원장 이상 필요)'::TEXT;
    RETURN;
  END IF;

  -- 2. 조정 레코드 조회
  SELECT 
    branch_id, adjustment_date, adjustment_type, product_id, quantity, is_cancelled,
    jsonb_build_object(
      'is_cancelled', false,
      'cancelled_by', NULL,
      'cancelled_at', NULL,
      'cancel_reason', NULL
    )
  INTO 
    v_adjustment_branch_id, v_adjustment_date, v_adjustment_type, 
    v_product_id, v_quantity, v_is_cancelled, v_old_data
  FROM inventory_adjustments
  WHERE id = p_adjustment_id::UUID;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '조정 내역을 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 3. 지점 격리
  IF p_user_role != '0000' AND v_adjustment_branch_id::TEXT != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 조정만 취소할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 4. 이미 취소된 조정인지 확인
  IF v_is_cancelled THEN
    RETURN QUERY SELECT false, '이미 취소된 조정입니다.'::TEXT;
    RETURN;
  END IF;

  -- 5. 당일 데이터만 취소 가능 (시스템 관리자 제외)
  IF p_user_role != '0000' AND v_adjustment_date != CURRENT_DATE THEN
    RETURN QUERY SELECT false, '당일 데이터만 취소할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 6. 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = v_adjustment_branch_id
  WHERE u.id = p_user_id::UUID;

  -- 7. 조정 취소 처리
  UPDATE inventory_adjustments
  SET 
    is_cancelled = true,
    cancelled_by = p_user_id::UUID,
    cancelled_at = NOW(),
    cancel_reason = p_cancel_reason
  WHERE id = p_adjustment_id::UUID;

  -- 8. inventory_layers 복원
  IF v_adjustment_type = 'INCREASE' THEN
    -- 증가 취소: 추가된 레이어 삭제
    DELETE FROM inventory_layers
    WHERE source_type = 'ADJUSTMENT' AND source_id = p_adjustment_id::UUID;
  ELSE
    -- 감소 취소: 차감된 수량 복원 (FIFO 역순)
    DECLARE
      v_layer_id UUID;
      v_layer_original NUMERIC;
      v_layer_remaining NUMERIC;
      v_to_restore NUMERIC := v_quantity;
    BEGIN
      FOR v_layer_id, v_layer_original, v_layer_remaining IN
        SELECT id, original_quantity, remaining_quantity
        FROM inventory_layers
        WHERE branch_id = v_adjustment_branch_id
          AND product_id = v_product_id
        ORDER BY purchase_date DESC, created_at DESC
      LOOP
        IF v_to_restore <= 0 THEN
          EXIT;
        END IF;

        IF (v_layer_original - v_layer_remaining) >= v_to_restore THEN
          -- 이 레이어에서 복원 가능
          UPDATE inventory_layers
          SET 
            remaining_quantity = remaining_quantity + v_to_restore,
            updated_at = NOW()
          WHERE id = v_layer_id;
          v_to_restore := 0;
        ELSE
          -- 이 레이어를 최대한 복원
          UPDATE inventory_layers
          SET 
            remaining_quantity = original_quantity,
            updated_at = NOW()
          WHERE id = v_layer_id;
          v_to_restore := v_to_restore - (v_layer_original - v_layer_remaining);
        END IF;
      END LOOP;
    END;
  END IF;

  -- 9. Audit Log 기록
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    username,
    user_role,
    branch_id,
    branch_name,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    'inventory_adjustments',
    p_adjustment_id,
    'UPDATE',
    p_user_id,
    v_username,
    p_user_role,
    v_adjustment_branch_id::TEXT,
    v_branch_name,
    v_old_data,
    jsonb_build_object(
      'is_cancelled', true,
      'cancelled_by', p_user_id,
      'cancelled_at', NOW(),
      'cancel_reason', p_cancel_reason
    ),
    ARRAY['is_cancelled', 'cancelled_by', 'cancelled_at', 'cancel_reason']
  );

  RETURN QUERY SELECT true, '재고 조정이 취소되었습니다.'::TEXT;
END;
$$;

COMMENT ON FUNCTION cancel_inventory_adjustment IS '재고 조정 취소 (원장 이상, 당일만 가능, inventory_layers 복원)';

-- =====================================================
-- 검증 쿼리
-- =====================================================
SELECT 
  'process_inventory_adjustment' AS function_name,
  COUNT(*) AS exists
FROM pg_proc
WHERE proname = 'process_inventory_adjustment'
UNION ALL
SELECT 
  'get_inventory_adjustments',
  COUNT(*)
FROM pg_proc
WHERE proname = 'get_inventory_adjustments'
UNION ALL
SELECT 
  'get_adjustment_summary',
  COUNT(*)
FROM pg_proc
WHERE proname = 'get_adjustment_summary'
UNION ALL
SELECT 
  'cancel_inventory_adjustment',
  COUNT(*)
FROM pg_proc
WHERE proname = 'cancel_inventory_adjustment';

-- =====================================================
-- Phase 5-2 완료 메시지
-- =====================================================
SELECT 
  '✅ Phase 5-2 완료: RPC 함수 4개 생성' AS status,
  'process_inventory_adjustment (FIFO 지원)' AS function_1,
  'get_inventory_adjustments (필터링)' AS function_2,
  'get_adjustment_summary (통계)' AS function_3,
  'cancel_inventory_adjustment (복원)' AS function_4,
  '다음: Phase 5-3 TypeScript 타입 및 Server Actions' AS next_step;
