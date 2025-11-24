-- =====================================================
-- 전체 데이터베이스 상태 진단 스크립트
-- =====================================================

-- ============================================
-- 1. 모든 테이블 확인
-- ============================================
SELECT 
    '테이블 목록' as category,
    tablename as name,
    schemaname as schema
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;


-- ============================================
-- 2. purchases 테이블 상태
-- ============================================
SELECT '--- purchases 테이블 ---' as info;

-- 테이블 존재 여부
SELECT 
    'purchases 테이블' as check_item,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'purchases') 
         THEN '존재 ✅' 
         ELSE '없음 ❌' 
    END as status;

-- purchases 컬럼 목록
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchases' AND table_schema = 'public'
ORDER BY ordinal_position;

-- purchases 데이터 개수
SELECT 'purchases 데이터 개수' as info, COUNT(*) as count FROM public.purchases;


-- ============================================
-- 3. sales 테이블 상태
-- ============================================
SELECT '--- sales 테이블 ---' as info;

-- 테이블 존재 여부
SELECT 
    'sales 테이블' as check_item,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'sales') 
         THEN '존재 ✅' 
         ELSE '없음 ❌' 
    END as status;

-- sales 컬럼 목록
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales' AND table_schema = 'public'
ORDER BY ordinal_position;

-- sales 데이터 개수
SELECT 'sales 데이터 개수' as info, COUNT(*) as count FROM public.sales;


-- ============================================
-- 4. RPC 함수 상태 (중요!)
-- ============================================
SELECT '--- RPC 함수 상태 ---' as info;

-- 함수 개수 확인
SELECT 
    proname as function_name,
    COUNT(*) as count,
    STRING_AGG(pg_get_function_arguments(oid), ' | ') as all_signatures
FROM pg_proc 
WHERE proname IN ('get_purchases_list', 'get_sales_list')
GROUP BY proname;

-- 함수 상세 정보
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as parameters,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    l.lanname as language
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE p.proname IN ('get_purchases_list', 'get_sales_list')
ORDER BY p.proname;


-- ============================================
-- 5. 실제 RPC 함수 테스트 (중요!)
-- ============================================
SELECT '--- 함수 실행 테스트 ---' as info;

-- get_purchases_list 함수 직접 호출 테스트
SELECT 'get_purchases_list 테스트' as test_name;
SELECT * FROM public.get_purchases_list(NULL, NULL, NULL) LIMIT 5;

-- get_sales_list 함수 직접 호출 테스트
SELECT 'get_sales_list 테스트' as test_name;
SELECT * FROM public.get_sales_list(NULL, NULL, NULL) LIMIT 5;


-- ============================================
-- 6. 관련 테이블 JOIN 확인
-- ============================================
SELECT '--- JOIN 가능 여부 확인 ---' as info;

-- branches 테이블
SELECT 'branches 테이블' as table_name, COUNT(*) as count FROM public.branches;

-- clients 테이블
SELECT 'clients 테이블' as table_name, COUNT(*) as count FROM public.clients;

-- products 테이블
SELECT 'products 테이블' as table_name, COUNT(*) as count FROM public.products;


-- ============================================
-- 7. FK 제약조건 확인
-- ============================================
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('purchases', 'sales')
ORDER BY tc.table_name, kcu.column_name;
