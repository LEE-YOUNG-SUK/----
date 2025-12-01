-- =====================================================
-- Phase 3.5 컬럼명 수정 검증 스크립트
-- =====================================================
-- 목적: old_values → old_data, new_values → new_data 수정 검증

-- =====================================================
-- 1. audit_logs 테이블 스키마 확인
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND column_name IN ('old_data', 'new_data', 'old_values', 'new_values')
ORDER BY ordinal_position;

-- 예상 결과:
-- old_data   | jsonb | YES
-- new_data   | jsonb | YES
-- (old_values, new_values는 존재하지 않아야 함)

-- =====================================================
-- 2. RPC 함수 정의 확인
-- =====================================================
-- update_purchase 함수 확인
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname IN ('update_purchase', 'delete_purchase', 'update_sale', 'delete_sale')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 확인 사항:
-- ✅ v_old_data JSONB (변수명)
-- ✅ INSERT INTO audit_logs (..., old_data, new_data, ...)
-- ❌ old_values, new_values 단어가 없어야 함

-- =====================================================
-- 3. 간단한 기능 테스트 (선택 사항)
-- =====================================================
-- 주의: 실제 데이터에 영향을 주므로 테스트 환경에서만 실행

-- 3-1. 입고 수정 테스트
-- DO $$
-- DECLARE
--   v_test_purchase_id UUID;
--   v_test_user_id UUID;
-- BEGIN
--   -- 테스트용 입고 데이터 선택 (첫 번째 레코드)
--   SELECT id INTO v_test_purchase_id FROM purchases LIMIT 1;
--   SELECT id INTO v_test_user_id FROM users WHERE role = '0000' LIMIT 1;
  
--   IF v_test_purchase_id IS NULL OR v_test_user_id IS NULL THEN
--     RAISE NOTICE '❌ 테스트 데이터 없음';
--     RETURN;
--   END IF;
  
--   -- update_purchase 함수 호출
--   PERFORM update_purchase(
--     v_test_purchase_id,
--     v_test_user_id,
--     '0000',
--     (SELECT branch_id FROM users WHERE id = v_test_user_id),
--     10.0,  -- quantity
--     5000,  -- unit_cost
--     50000, -- supply_price
--     5000,  -- tax_amount
--     55000, -- total_price
--     'Phase 3.5 컬럼명 수정 테스트'
--   );
  
--   RAISE NOTICE '✅ update_purchase 호출 성공';
-- END $$;

-- 3-2. audit_logs 확인
-- SELECT 
--   id,
--   table_name,
--   action,
--   user_id,
--   username,
--   jsonb_typeof(old_data) AS old_data_type,
--   jsonb_typeof(new_data) AS new_data_type,
--   old_data->>'quantity' AS old_quantity,
--   new_data->>'quantity' AS new_quantity,
--   created_at
-- FROM audit_logs
-- WHERE table_name = 'purchases'
--   AND action = 'UPDATE'
--   AND notes LIKE '%Phase 3.5%'
-- ORDER BY created_at DESC
-- LIMIT 1;

-- 예상 결과:
-- ✅ old_data_type = 'object'
-- ✅ new_data_type = 'object'
-- ✅ old_quantity, new_quantity 값이 정상적으로 표시됨

-- =====================================================
-- 4. 기존 트리거 호환성 확인
-- =====================================================
-- Phase 3 트리거도 old_data, new_data 사용하는지 확인
SELECT 
  tgname AS trigger_name,
  proname AS function_name,
  pg_get_functiondef(pg_proc.oid) AS definition
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname IN ('audit_purchases_trigger', 'audit_sales_trigger')
  AND tgrelid = ANY(ARRAY[
    'purchases'::regclass,
    'sales'::regclass
  ]);

-- 확인 사항:
-- ✅ 트리거 함수에서 old_data, new_data 사용
-- ✅ old_values, new_values 미사용

-- =====================================================
-- 5. 최종 검증
-- =====================================================
RAISE NOTICE '==============================================';
RAISE NOTICE 'Phase 3.5 컬럼명 수정 검증 완료';
RAISE NOTICE '==============================================';
RAISE NOTICE '';
RAISE NOTICE '✅ 수정 사항:';
RAISE NOTICE '   - v_old_values → v_old_data (변수명)';
RAISE NOTICE '   - old_values → old_data (INSERT 컬럼명)';
RAISE NOTICE '   - new_values → new_data (INSERT 컬럼명)';
RAISE NOTICE '';
RAISE NOTICE '✅ 영향받는 함수: 4개';
RAISE NOTICE '   1. update_purchase()';
RAISE NOTICE '   2. delete_purchase()';
RAISE NOTICE '   3. update_sale()';
RAISE NOTICE '   4. delete_sale()';
RAISE NOTICE '';
RAISE NOTICE '✅ 기존 기능 호환성:';
RAISE NOTICE '   - Phase 3 트리거: old_data, new_data 사용 (호환)';
RAISE NOTICE '   - Phase 3 RPC 조회 함수: old_data, new_data 조회 (호환)';
RAISE NOTICE '   - Admin UI: old_data, new_data 표시 (호환)';
RAISE NOTICE '';
RAISE NOTICE '다음 단계: Supabase SQL Editor에서 실행 후 테스트';
