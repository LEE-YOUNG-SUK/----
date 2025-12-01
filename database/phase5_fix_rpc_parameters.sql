-- =====================================================
-- Phase 5: RPC 함수 파라미터 타입 수정
-- =====================================================
-- 문제: UUID 파라미터를 TEXT로 변경하여 타입 불일치 해결
-- 해결: RETURNS TABLE과 SELECT 캐스팅 일치

-- 1. 기존 함수 삭제 (오버로딩 방지)
DROP FUNCTION IF EXISTS get_inventory_adjustments(UUID, TEXT, UUID, DATE, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_adjustment_summary(UUID, TEXT, UUID, DATE, DATE);
DROP FUNCTION IF EXISTS cancel_inventory_adjustment(UUID, UUID, TEXT, UUID, TEXT);

-- 2. get_inventory_adjustments() - TEXT 파라미터 버전
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
    b.name::TEXT AS branch_name,
    ia.product_id::TEXT,
    p.code::TEXT AS product_code,
    p.name::TEXT AS product_name,
    ia.unit::TEXT,
    ia.adjustment_type::TEXT,
    ia.adjustment_reason::TEXT,
    ia.quantity,
    ia.unit_cost,
    ia.supply_price,
    ia.tax_amount,
    ia.total_cost,
    ia.adjustment_date,
    ia.notes::TEXT,
    ia.reference_number::TEXT,
    ia.created_by::TEXT,
    u1.username::TEXT AS created_by_username,
    ia.created_at,
    ia.is_cancelled,
    ia.cancelled_by::TEXT,
    u2.username::TEXT AS cancelled_by_username,
    ia.cancelled_at,
    ia.cancel_reason::TEXT
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

-- 3. get_adjustment_summary() - TEXT 파라미터 버전
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

-- 4. cancel_inventory_adjustment() - TEXT 파라미터 버전
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

-- 검증
SELECT 
  'get_inventory_adjustments' AS function_name,
  COUNT(*) AS exists,
  string_agg(pg_get_function_arguments(oid), ' | ') AS parameters
FROM pg_proc
WHERE proname = 'get_inventory_adjustments'
GROUP BY proname
UNION ALL
SELECT 
  'get_adjustment_summary',
  COUNT(*),
  string_agg(pg_get_function_arguments(oid), ' | ')
FROM pg_proc
WHERE proname = 'get_adjustment_summary'
GROUP BY proname
UNION ALL
SELECT 
  'cancel_inventory_adjustment',
  COUNT(*),
  string_agg(pg_get_function_arguments(oid), ' | ')
FROM pg_proc
WHERE proname = 'cancel_inventory_adjustment'
GROUP BY proname;
