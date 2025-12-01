-- =====================================================
-- Phase 3-2: Audit Log 트리거 생성
-- =====================================================
-- 목적: purchases, sales 테이블의 UPDATE/DELETE 시 자동 로깅
-- 방식: 트리거 함수 + AFTER 트리거

-- =====================================================
-- 1. 공통 헬퍼 함수: 현재 사용자 정보 가져오기
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_audit_user()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  user_role TEXT,
  branch_id UUID,
  branch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_user_data RECORD;
BEGIN
  -- Server Actions에서 설정한 user_id 가져오기
  BEGIN
    v_user_id := current_setting('app.current_user_id', false);
  EXCEPTION
    WHEN undefined_object THEN
      v_user_id := NULL;
  END;
  
  IF v_user_id IS NULL OR v_user_id = '' THEN
    -- 기본값: 시스템 사용자 (트리거 외부 실행 시)
    RETURN QUERY
    SELECT 
      '00000000-0000-0000-0000-000000000000'::UUID,
      'system'::TEXT,
      '0000'::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- 사용자 정보 조회
  SELECT 
    u.id,
    u.username,
    u.role,
    u.branch_id,
    b.name AS branch_name
  INTO v_user_data
  FROM users u
  LEFT JOIN branches b ON u.branch_id = b.id
  WHERE u.id = v_user_id::UUID;
  
  IF NOT FOUND THEN
    -- 사용자를 찾을 수 없으면 시스템 사용자
    RETURN QUERY
    SELECT 
      '00000000-0000-0000-0000-000000000000'::UUID,
      'system'::TEXT,
      '0000'::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    v_user_data.id,
    v_user_data.username,
    v_user_data.role,
    v_user_data.branch_id,
    v_user_data.branch_name;
END;
$$;

COMMENT ON FUNCTION get_current_audit_user() IS '현재 감사 로그용 사용자 정보 반환 (세션 설정 기반)';

-- =====================================================
-- 2. purchases 테이블 트리거 함수
-- =====================================================
CREATE OR REPLACE FUNCTION audit_purchases_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_user RECORD;
BEGIN
  -- 현재 사용자 정보 가져오기
  SELECT * INTO v_audit_user FROM get_current_audit_user();
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      user_id,
      username,
      user_role,
      branch_id,
      branch_name
    ) VALUES (
      'purchases',
      OLD.id,
      'DELETE',
      row_to_json(OLD)::JSONB,
      NULL,
      NULL,
      v_audit_user.user_id,
      v_audit_user.username,
      v_audit_user.user_role,
      OLD.branch_id,
      v_audit_user.branch_name
    );
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      user_id,
      username,
      user_role,
      branch_id,
      branch_name
    ) VALUES (
      'purchases',
      NEW.id,
      'UPDATE',
      row_to_json(OLD)::JSONB,
      row_to_json(NEW)::JSONB,
      get_changed_fields(row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB),
      v_audit_user.user_id,
      v_audit_user.username,
      v_audit_user.user_role,
      NEW.branch_id,
      v_audit_user.branch_name
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION audit_purchases_changes() IS '입고(purchases) 테이블 변경 감사 로깅';

-- =====================================================
-- 3. sales 테이블 트리거 함수
-- =====================================================
CREATE OR REPLACE FUNCTION audit_sales_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_user RECORD;
BEGIN
  SELECT * INTO v_audit_user FROM get_current_audit_user();
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      user_id,
      username,
      user_role,
      branch_id,
      branch_name
    ) VALUES (
      'sales',
      OLD.id,
      'DELETE',
      row_to_json(OLD)::JSONB,
      NULL,
      NULL,
      v_audit_user.user_id,
      v_audit_user.username,
      v_audit_user.user_role,
      OLD.branch_id,
      v_audit_user.branch_name
    );
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      user_id,
      username,
      user_role,
      branch_id,
      branch_name
    ) VALUES (
      'sales',
      NEW.id,
      'UPDATE',
      row_to_json(OLD)::JSONB,
      row_to_json(NEW)::JSONB,
      get_changed_fields(row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB),
      v_audit_user.user_id,
      v_audit_user.username,
      v_audit_user.user_role,
      NEW.branch_id,
      v_audit_user.branch_name
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION audit_sales_changes() IS '판매(sales) 테이블 변경 감사 로깅';

-- =====================================================
-- 4. 트리거 생성
-- =====================================================

-- purchases 테이블 트리거
DROP TRIGGER IF EXISTS audit_purchases_trigger ON purchases;
CREATE TRIGGER audit_purchases_trigger
  AFTER UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION audit_purchases_changes();

-- sales 테이블 트리거
DROP TRIGGER IF EXISTS audit_sales_trigger ON sales;
CREATE TRIGGER audit_sales_trigger
  AFTER UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION audit_sales_changes();

-- =====================================================
-- 5. 권한 부여
-- =====================================================
GRANT EXECUTE ON FUNCTION get_current_audit_user() TO authenticated;
GRANT EXECUTE ON FUNCTION audit_purchases_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION audit_sales_changes() TO authenticated;

-- =====================================================
-- 6. 트리거 생성 확인
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ get_current_audit_user() 헬퍼 함수 생성 완료';
  RAISE NOTICE '✅ audit_purchases_changes() 트리거 함수 생성 완료';
  RAISE NOTICE '✅ audit_sales_changes() 트리거 함수 생성 완료';
  RAISE NOTICE '✅ purchases 테이블 트리거 연결 완료';
  RAISE NOTICE '✅ sales 테이블 트리거 연결 완료';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  중요: Server Actions에서 사용자 컨텍스트 설정 필요';
  RAISE NOTICE '   예시: PERFORM set_config(''app.current_user_id'', user_id, false);';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계: Phase 3-3 (Server Actions 수정)';
END $$;
