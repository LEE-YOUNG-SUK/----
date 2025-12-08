-- ============================================
-- 기존 함수 시그니처 확인 쿼리
-- ============================================
-- Supabase SQL Editor에서 실행하여 기존 함수 정의를 확인하세요

-- 1. 모든 사용자 관리 관련 함수 조회
SELECT 
    routine_name,
    routine_type,
    data_type,
    type_udt_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_all_users',
    'create_user',
    'update_user',
    'delete_user',
    'update_user_password'
  )
ORDER BY routine_name;

-- 2. 함수 파라미터 확인
SELECT 
    r.routine_name,
    p.parameter_name,
    p.data_type,
    p.parameter_mode,
    p.parameter_default,
    p.ordinal_position
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p 
    ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
  AND r.routine_name IN (
    'get_all_users',
    'create_user',
    'update_user',
    'delete_user',
    'update_user_password'
  )
ORDER BY r.routine_name, p.ordinal_position;

-- 3. 함수 정의 확인 (pg_proc 사용)
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    p.prosrc AS source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_all_users',
    'create_user',
    'update_user',
    'delete_user',
    'update_user_password'
  )
ORDER BY p.proname;

