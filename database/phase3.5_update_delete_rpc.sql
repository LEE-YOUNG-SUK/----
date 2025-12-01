-- =====================================================
-- Phase 3.5: 입고/판매 수정/삭제 RPC 함수
-- =====================================================
-- 목적: 입고/판매 데이터 수정 및 삭제 기능 제공
-- Audit Log 트리거 자동 발동

-- =====================================================
-- 1. 입고 수정 함수
-- =====================================================
CREATE OR REPLACE FUNCTION update_purchase(
  p_purchase_id UUID,
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_supply_price NUMERIC,
  p_tax_amount NUMERIC,
  p_total_price NUMERIC,
  p_notes TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_branch_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_username TEXT;
  v_branch_name TEXT;
BEGIN
  -- 입고 레코드 존재 및 지점 확인 + old_data 저장
  SELECT 
    branch_id,
    jsonb_build_object(
      'quantity', quantity,
      'unit_cost', unit_cost,
      'supply_price', supply_price,
      'tax_amount', tax_amount,
      'total_price', total_price,
      'notes', notes
    )
  INTO v_purchase_branch_id, v_old_data
  FROM purchases
  WHERE id = p_purchase_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '입고 레코드를 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 권한 검증: 시스템 관리자가 아니면 본인 지점만 수정 가능
  IF p_user_role != '0000' AND v_purchase_branch_id != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 입고만 수정할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 수정 권한 확인 (CRU 권한 필요)
  IF p_user_role NOT IN ('0000', '0001', '0002', '0003') THEN
    RETURN QUERY SELECT false, '입고 수정 권한이 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = COALESCE(v_purchase_branch_id, p_user_branch_id)
  WHERE u.id = p_user_id;

  -- 새 데이터 생성
  v_new_data := jsonb_build_object(
    'quantity', p_quantity,
    'unit_cost', p_unit_cost,
    'supply_price', p_supply_price,
    'tax_amount', p_tax_amount,
    'total_price', p_total_price,
    'notes', p_notes
  );

  -- 변경된 필드 계산
  v_changed_fields := ARRAY[]::TEXT[];
  IF (v_old_data->>'quantity')::NUMERIC != p_quantity THEN
    v_changed_fields := array_append(v_changed_fields, 'quantity');
  END IF;
  IF (v_old_data->>'unit_cost')::NUMERIC != p_unit_cost THEN
    v_changed_fields := array_append(v_changed_fields, 'unit_cost');
  END IF;
  IF (v_old_data->>'supply_price')::NUMERIC != p_supply_price THEN
    v_changed_fields := array_append(v_changed_fields, 'supply_price');
  END IF;
  IF (v_old_data->>'tax_amount')::NUMERIC != p_tax_amount THEN
    v_changed_fields := array_append(v_changed_fields, 'tax_amount');
  END IF;
  IF (v_old_data->>'total_price')::NUMERIC != p_total_price THEN
    v_changed_fields := array_append(v_changed_fields, 'total_price');
  END IF;
  IF COALESCE(v_old_data->>'notes', '') != COALESCE(p_notes, '') THEN
    v_changed_fields := array_append(v_changed_fields, 'notes');
  END IF;

  -- 입고 수정
  UPDATE purchases
  SET
    quantity = p_quantity,
    unit_cost = p_unit_cost,
    supply_price = p_supply_price,
    tax_amount = p_tax_amount,
    total_price = p_total_price,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_purchase_id;

  -- Audit Log 직접 기록
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
    'purchases',
    p_purchase_id,
    'UPDATE',
    p_user_id,
    v_username,
    p_user_role,
    v_purchase_branch_id,
    v_branch_name,
    v_old_data,
    v_new_data,
    v_changed_fields
  );

  RETURN QUERY SELECT true, '입고 정보가 수정되었습니다.'::TEXT;
END;
$$;

COMMENT ON FUNCTION update_purchase IS '입고 데이터 수정 (Audit Log 트리거 발동)';

-- =====================================================
-- 2. 입고 삭제 함수
-- =====================================================
CREATE OR REPLACE FUNCTION delete_purchase(
  p_purchase_id UUID,
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_branch_id UUID;
  v_old_data JSONB;
  v_username TEXT;
  v_branch_name TEXT;
BEGIN
  -- 입고 레코드 존재 및 지점 확인 + old_data 저장
  SELECT 
    branch_id,
    jsonb_build_object(
      'quantity', quantity,
      'unit_cost', unit_cost,
      'supply_price', supply_price,
      'tax_amount', tax_amount,
      'total_price', total_price,
      'product_id', product_id,
      'client_id', client_id,
      'purchase_date', purchase_date,
      'notes', notes
    )
  INTO v_purchase_branch_id, v_old_data
  FROM purchases
  WHERE id = p_purchase_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '입고 레코드를 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 권한 검증: 시스템 관리자가 아니면 본인 지점만 삭제 가능
  IF p_user_role != '0000' AND v_purchase_branch_id != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 입고만 삭제할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 삭제 권한 확인 (원장 이상만 삭제 가능, 사용자는 불가)
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RETURN QUERY SELECT false, '입고 삭제 권한이 없습니다. (원장 이상 필요)'::TEXT;
    RETURN;
  END IF;

  -- 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = v_purchase_branch_id
  WHERE u.id = p_user_id;

  -- Audit Log 먼저 기록 (DELETE 전에)
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
    new_data
  ) VALUES (
    'purchases',
    p_purchase_id,
    'DELETE',
    p_user_id,
    v_username,
    p_user_role,
    v_purchase_branch_id,
    v_branch_name,
    v_old_data,
    NULL
  );

  -- 입고 삭제
  DELETE FROM purchases
  WHERE id = p_purchase_id;

  RETURN QUERY SELECT true, '입고 데이터가 삭제되었습니다.'::TEXT;
END;
$$;

COMMENT ON FUNCTION delete_purchase IS '입고 데이터 삭제 (원장 이상, Audit Log 트리거 발동)';

-- =====================================================
-- 3. 판매 수정 함수
-- =====================================================
CREATE OR REPLACE FUNCTION update_sale(
  p_sale_id UUID,
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_supply_price NUMERIC,
  p_tax_amount NUMERIC,
  p_total_price NUMERIC,
  p_notes TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_branch_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_username TEXT;
  v_branch_name TEXT;
BEGIN
  -- 판매 레코드 존재 및 지점 확인 + old_data 저장
  SELECT 
    branch_id,
    jsonb_build_object(
      'quantity', quantity,
      'unit_price', unit_price,
      'supply_price', supply_price,
      'tax_amount', tax_amount,
      'total_price', total_price,
      'notes', notes
    )
  INTO v_sale_branch_id, v_old_data
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '판매 레코드를 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 권한 검증: 시스템 관리자가 아니면 본인 지점만 수정 가능
  IF p_user_role != '0000' AND v_sale_branch_id != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 판매만 수정할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 수정 권한 확인 (CRU 권한 필요)
  IF p_user_role NOT IN ('0000', '0001', '0002', '0003') THEN
    RETURN QUERY SELECT false, '판매 수정 권한이 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = COALESCE(v_sale_branch_id, p_user_branch_id)
  WHERE u.id = p_user_id;

  -- 새 데이터 생성
  v_new_data := jsonb_build_object(
    'quantity', p_quantity,
    'unit_price', p_unit_price,
    'supply_price', p_supply_price,
    'tax_amount', p_tax_amount,
    'total_price', p_total_price,
    'notes', p_notes
  );

  -- 변경된 필드 계산
  v_changed_fields := ARRAY[]::TEXT[];
  IF (v_old_data->>'quantity')::NUMERIC != p_quantity THEN
    v_changed_fields := array_append(v_changed_fields, 'quantity');
  END IF;
  IF (v_old_data->>'unit_price')::NUMERIC != p_unit_price THEN
    v_changed_fields := array_append(v_changed_fields, 'unit_price');
  END IF;
  IF (v_old_data->>'supply_price')::NUMERIC != p_supply_price THEN
    v_changed_fields := array_append(v_changed_fields, 'supply_price');
  END IF;
  IF (v_old_data->>'tax_amount')::NUMERIC != p_tax_amount THEN
    v_changed_fields := array_append(v_changed_fields, 'tax_amount');
  END IF;
  IF (v_old_data->>'total_price')::NUMERIC != p_total_price THEN
    v_changed_fields := array_append(v_changed_fields, 'total_price');
  END IF;
  IF COALESCE(v_old_data->>'notes', '') != COALESCE(p_notes, '') THEN
    v_changed_fields := array_append(v_changed_fields, 'notes');
  END IF;

  -- 판매 수정
  UPDATE sales
  SET
    quantity = p_quantity,
    unit_price = p_unit_price,
    supply_price = p_supply_price,
    tax_amount = p_tax_amount,
    total_price = p_total_price,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- Audit Log 직접 기록
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
    'sales',
    p_sale_id,
    'UPDATE',
    p_user_id,
    v_username,
    p_user_role,
    v_sale_branch_id,
    v_branch_name,
    v_old_data,
    v_new_data,
    v_changed_fields
  );

  RETURN QUERY SELECT true, '판매 정보가 수정되었습니다.'::TEXT;
END;
$$;

COMMENT ON FUNCTION update_sale IS '판매 데이터 수정 (Audit Log 트리거 발동)';

-- =====================================================
-- 4. 판매 삭제 함수
-- =====================================================
CREATE OR REPLACE FUNCTION delete_sale(
  p_sale_id UUID,
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_branch_id UUID;
  v_old_data JSONB;
  v_username TEXT;
  v_branch_name TEXT;
BEGIN
  -- 판매 레코드 존재 및 지점 확인 + old_data 저장
  SELECT 
    branch_id,
    jsonb_build_object(
      'quantity', quantity,
      'unit_price', unit_price,
      'supply_price', supply_price,
      'tax_amount', tax_amount,
      'total_price', total_price,
      'product_id', product_id,
      'client_id', client_id,
      'sale_date', sale_date,
      'notes', notes
    )
  INTO v_sale_branch_id, v_old_data
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, '판매 레코드를 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 권한 검증: 시스템 관리자가 아니면 본인 지점만 삭제 가능
  IF p_user_role != '0000' AND v_sale_branch_id != p_user_branch_id THEN
    RETURN QUERY SELECT false, '본인 지점의 판매만 삭제할 수 있습니다.'::TEXT;
    RETURN;
  END IF;

  -- 삭제 권한 확인 (원장 이상만 삭제 가능, 사용자는 불가)
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RETURN QUERY SELECT false, '판매 삭제 권한이 없습니다. (원장 이상 필요)'::TEXT;
    RETURN;
  END IF;

  -- 사용자 정보 조회
  SELECT u.username, b.name
  INTO v_username, v_branch_name
  FROM users u
  LEFT JOIN branches b ON b.id = v_sale_branch_id
  WHERE u.id = p_user_id;

  -- Audit Log 먼저 기록 (DELETE 전에)
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
    new_data
  ) VALUES (
    'sales',
    p_sale_id,
    'DELETE',
    p_user_id,
    v_username,
    p_user_role,
    v_sale_branch_id,
    v_branch_name,
    v_old_data,
    NULL
  );

  -- 판매 삭제
  DELETE FROM sales
  WHERE id = p_sale_id;

  RETURN QUERY SELECT true, '판매 데이터가 삭제되었습니다.'::TEXT;
END;
$$;

COMMENT ON FUNCTION delete_sale IS '판매 데이터 삭제 (원장 이상, Audit Log 트리거 발동)';

-- =====================================================
-- 5. 권한 부여
-- =====================================================
GRANT EXECUTE ON FUNCTION update_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION delete_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION update_sale TO authenticated;
GRANT EXECUTE ON FUNCTION delete_sale TO authenticated;

-- =====================================================
-- 6. 함수 생성 확인
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ update_purchase() - 입고 수정 함수 생성 완료';
  RAISE NOTICE '✅ delete_purchase() - 입고 삭제 함수 생성 완료 (원장 이상)';
  RAISE NOTICE '✅ update_sale() - 판매 수정 함수 생성 완료';
  RAISE NOTICE '✅ delete_sale() - 판매 삭제 함수 생성 완료 (원장 이상)';
  RAISE NOTICE '';
  RAISE NOTICE '권한 설정:';
  RAISE NOTICE '  - 수정: 모든 역할 (0000~0003) + 지점 격리';
  RAISE NOTICE '  - 삭제: 원장 이상 (0000~0002) + 지점 격리';
  RAISE NOTICE '  - Audit Log: UPDATE/DELETE 트리거 자동 발동';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계: Step 2 - Server Actions 생성';
END $$;
