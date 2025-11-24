-- =====================================================
-- 설치 완료 확인 쿼리
-- =====================================================

-- ============================================
-- 1. 테이블 존재 확인
-- ============================================
SELECT 
    '테이블' as type,
    tablename as name
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('purchases', 'sales', 'inventory_layers')
ORDER BY tablename;


-- ============================================
-- 2. sales 테이블의 컬럼 확인 (cost_of_goods_sold 있는지)
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sales'
ORDER BY ordinal_position;


-- ============================================
-- 3. RPC 함수 존재 및 파라미터 타입 확인
-- ============================================
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as parameters
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('get_purchases_list', 'get_sales_list')
ORDER BY p.proname;


-- ============================================
-- 4. 예상 결과
-- ============================================
-- 테이블: 3개 (purchases, sales, inventory_layers)
-- sales 컬럼: cost_of_goods_sold, profit 포함
-- 함수: get_purchases_list(p_branch_id text, ...), get_sales_list(p_branch_id text, ...)
-- 중요: 파라미터가 "text" 타입이어야 함! (uuid 아님)
