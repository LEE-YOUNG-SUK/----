-- =====================================================
-- 감사로그 개선: 품목명 포함 및 필터링
-- =====================================================

-- 1. purchases 트리거 함수 수정 (품목명 포함)
DROP FUNCTION IF EXISTS audit_purchases_changes() CASCADE;

CREATE OR REPLACE FUNCTION audit_purchases_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_user RECORD;
  v_old_data JSONB;
  v_new_data JSONB;
  v_product_name TEXT;
BEGIN
  -- 현재 사용자 정보 가져오기
  SELECT * INTO v_audit_user FROM get_current_audit_user();
  
  IF TG_OP = 'DELETE' THEN
    -- 품목명 조회
    SELECT name INTO v_product_name FROM products WHERE id = OLD.product_id;
    
    -- old_data에 품목명 추가
    v_old_data := row_to_json(OLD)::JSONB || jsonb_build_object('product_name', v_product_name);
    
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
      v_old_data,
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
    -- 품목명 조회
    SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;
    
    -- old_data, new_data에 품목명 추가
    v_old_data := row_to_json(OLD)::JSONB || jsonb_build_object('product_name', v_product_name);
    v_new_data := row_to_json(NEW)::JSONB || jsonb_build_object('product_name', v_product_name);
    
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
      v_old_data,
      v_new_data,
      get_changed_fields(v_old_data, v_new_data),
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

COMMENT ON FUNCTION audit_purchases_changes() IS '입고(purchases) 테이블 변경 감사 로깅 (품목명 포함)';

-- 2. sales 트리거 함수 수정 (품목명 포함)
DROP FUNCTION IF EXISTS audit_sales_changes() CASCADE;

CREATE OR REPLACE FUNCTION audit_sales_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_user RECORD;
  v_old_data JSONB;
  v_new_data JSONB;
  v_product_name TEXT;
BEGIN
  -- 현재 사용자 정보 가져오기
  SELECT * INTO v_audit_user FROM get_current_audit_user();
  
  IF TG_OP = 'DELETE' THEN
    -- 품목명 조회
    SELECT name INTO v_product_name FROM products WHERE id = OLD.product_id;
    
    -- old_data에 품목명 추가
    v_old_data := row_to_json(OLD)::JSONB || jsonb_build_object('product_name', v_product_name);
    
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
      v_old_data,
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
    -- 품목명 조회
    SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;
    
    -- old_data, new_data에 품목명 추가
    v_old_data := row_to_json(OLD)::JSONB || jsonb_build_object('product_name', v_product_name);
    v_new_data := row_to_json(NEW)::JSONB || jsonb_build_object('product_name', v_product_name);
    
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
      v_old_data,
      v_new_data,
      get_changed_fields(v_old_data, v_new_data),
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

COMMENT ON FUNCTION audit_sales_changes() IS '판매(sales) 테이블 변경 감사 로깅 (품목명 포함)';

-- 3. 트리거 재생성
DROP TRIGGER IF EXISTS audit_purchases_trigger ON purchases;
CREATE TRIGGER audit_purchases_trigger
  AFTER UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION audit_purchases_changes();

DROP TRIGGER IF EXISTS audit_sales_trigger ON sales;
CREATE TRIGGER audit_sales_trigger
  AFTER UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION audit_sales_changes();

-- 4. 권한 부여
GRANT EXECUTE ON FUNCTION audit_purchases_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION audit_sales_changes() TO authenticated;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 감사로그 트리거 함수 수정 완료 (품목명 포함)';
  RAISE NOTICE '✅ purchases, sales 트리거 재생성 완료';
  RAISE NOTICE '';
  RAISE NOTICE '📝 변경 사항:';
  RAISE NOTICE '   - old_data, new_data에 product_name 필드 자동 추가';
  RAISE NOTICE '   - inventory_adjustments는 감사로그에서 제외 (트리거 없음)';
END $$;
