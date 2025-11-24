-- =====================================================
-- 간단한 데이터베이스 상태 확인
-- =====================================================

-- 1. 테이블 존재 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
AND tablename IN ('purchases', 'sales', 'inventory_layers')
ORDER BY tablename;

-- 2. purchases 테이블 컬럼 타입 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchases' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. sales 테이블 컬럼 타입 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. purchases 데이터 개수
SELECT 'purchases' as table_name, COUNT(*) as count FROM public.purchases;

-- 5. sales 데이터 개수
SELECT 'sales' as table_name, COUNT(*) as count FROM public.sales;

-- 6. RPC 함수 확인
SELECT proname, pg_get_function_arguments(oid) as params
FROM pg_proc 
WHERE proname IN ('get_purchases_list', 'get_sales_list')
ORDER BY proname;
