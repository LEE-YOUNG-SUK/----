-- =====================================================
-- Phase 5: cancel_inventory_adjustment 함수 수정
-- =====================================================
-- 수정: audit_logs의 record_id, user_id, branch_id를 UUID로 캐스팅

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

  -- 9. Audit Log 기록 (UUID 타입으로 캐스팅)
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
    p_adjustment_id::UUID,        -- TEXT → UUID 캐스팅
    'UPDATE',
    p_user_id::UUID,               -- TEXT → UUID 캐스팅
    v_username,
    p_user_role,
    v_adjustment_branch_id,        -- 이미 UUID 타입
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

-- 검증
SELECT 
  proname AS function_name,
  pronargs AS arg_count,
  prorettype::regtype AS return_type
FROM pg_proc
WHERE proname = 'cancel_inventory_adjustment';
