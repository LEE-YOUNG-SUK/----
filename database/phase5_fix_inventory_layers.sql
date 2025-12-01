-- =====================================================
-- Phase 5: process_inventory_adjustment 함수 수정
-- =====================================================
-- 수정: inventory_layers에서 reference_number 컬럼 제거

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
    -- 재고 증가: 신규 레이어 추가 (reference_number 제거됨)
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

-- 검증
SELECT 
  'process_inventory_adjustment' AS function_name,
  COUNT(*) AS exists
FROM pg_proc
WHERE proname = 'process_inventory_adjustment';

-- 함수가 성공적으로 생성되었는지 확인
SELECT 
  proname AS function_name,
  pronargs AS arg_count,
  prorettype::regtype AS return_type
FROM pg_proc
WHERE proname = 'process_inventory_adjustment';
