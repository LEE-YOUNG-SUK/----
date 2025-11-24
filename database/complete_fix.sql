-- =====================================================
-- 완전 초기화 및 재설정 스크립트
-- =====================================================

-- ============================================
-- 1단계: 모든 RPC 함수 완전 삭제
-- ============================================

-- 모든 get_purchases_list 함수 삭제 (시그니처 무관)
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_purchases_list'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
        RAISE NOTICE '삭제: %', func_record.oid::regprocedure;
    END LOOP;
    
    RAISE NOTICE '✅ get_purchases_list 모든 버전 삭제 완료';
END $$;

-- 모든 get_sales_list 함수 삭제 (시그니처 무관)
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_sales_list'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
        RAISE NOTICE '삭제: %', func_record.oid::regprocedure;
    END LOOP;
    
    RAISE NOTICE '✅ get_sales_list 모든 버전 삭제 완료';
    RAISE NOTICE '✅ 1단계 완료: 모든 중복 함수 제거';
END $$;


-- ============================================
-- 2단계: TEXT 타입으로 함수 생성
-- ============================================

-- 입고 내역 조회 함수
CREATE FUNCTION public.get_purchases_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  client_id TEXT,
  client_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  purchase_date DATE,
  quantity NUMERIC,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.branch_id,
    COALESCE(b.name, '') AS branch_name,
    p.client_id,
    COALESCE(c.name, '') AS client_name,
    p.product_id,
    COALESCE(pr.code, '') AS product_code,
    COALESCE(pr.name, '') AS product_name,
    COALESCE(pr.unit, '') AS unit,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    p.total_cost,
    COALESCE(p.reference_number, '') AS reference_number,
    COALESCE(p.notes, '') AS notes,
    p.created_at,
    COALESCE(p.created_by, '') AS created_by
  FROM public.purchases p
  LEFT JOIN public.branches b ON p.branch_id = b.id
  LEFT JOIN public.clients c ON p.client_id = c.id
  LEFT JOIN public.products pr ON p.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;


-- 판매 내역 조회 함수
CREATE FUNCTION public.get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  client_id TEXT,
  client_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  sale_date DATE,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC,
  cost_of_goods_sold NUMERIC,
  profit NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.branch_id,
    COALESCE(b.name, '') AS branch_name,
    s.client_id,
    COALESCE(c.name, '') AS client_name,
    s.product_id,
    COALESCE(pr.code, '') AS product_code,
    COALESCE(pr.name, '') AS product_name,
    COALESCE(pr.unit, '') AS unit,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.total_price,
    COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods_sold,
    COALESCE(s.profit, 0) AS profit,
    COALESCE(s.reference_number, '') AS reference_number,
    COALESCE(s.notes, '') AS notes,
    s.created_at,
    COALESCE(s.created_by, '') AS created_by
  FROM public.sales s
  LEFT JOIN public.branches b ON s.branch_id = b.id
  LEFT JOIN public.clients c ON s.client_id = c.id
  LEFT JOIN public.products pr ON s.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;


-- ============================================
-- 3단계: 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_purchases_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchases_list(TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.get_sales_list(TEXT, DATE, DATE) TO anon;


-- ============================================
-- 4단계: 검증
-- ============================================
DO $$
DECLARE
    purchase_count INTEGER;
    sales_count INTEGER;
BEGIN
    -- get_purchases_list 함수 개수 확인
    SELECT COUNT(*) INTO purchase_count
    FROM pg_proc 
    WHERE proname = 'get_purchases_list';
    
    -- get_sales_list 함수 개수 확인
    SELECT COUNT(*) INTO sales_count
    FROM pg_proc 
    WHERE proname = 'get_sales_list';
    
    RAISE NOTICE '=================================';
    RAISE NOTICE '검증 결과:';
    RAISE NOTICE 'get_purchases_list 함수 개수: %', purchase_count;
    RAISE NOTICE 'get_sales_list 함수 개수: %', sales_count;
    
    IF purchase_count = 1 AND sales_count = 1 THEN
        RAISE NOTICE '✅ 성공: 각 함수가 1개씩만 존재합니다!';
    ELSE
        RAISE WARNING '⚠️ 경고: 중복 함수가 여전히 존재할 수 있습니다.';
    END IF;
    RAISE NOTICE '=================================';
END $$;
