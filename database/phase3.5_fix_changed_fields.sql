-- =====================================================
-- Phase 3.5 Fix: changed_fields NULL 문제 해결
-- =====================================================
-- 문제: UPDATE 액션에서 changed_fields가 NULL로 저장됨
-- 해결: RPC 함수에서 변경된 필드를 자동 계산하도록 수정

-- ✅ 실행 방법:
-- 1. Supabase SQL Editor에서 이 파일 전체 실행
-- 2. UI에서 입고/판매 수정 테스트
-- 3. phase3_quick_check.sql의 [체크 6] 재실행
-- 4. validation_status가 '✅ OK'로 변경되는지 확인

-- =====================================================
-- 1. 입고 수정 함수 재생성
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

-- =====================================================
-- 2. 판매 수정 함수 재생성
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

-- =====================================================
-- 검증
-- =====================================================
SELECT 
  'phase3.5_fix_changed_fields.sql executed successfully' AS status,
  '2 functions updated: update_purchase, update_sale' AS details,
  'Please test UPDATE operation and check changed_fields column' AS next_step;
