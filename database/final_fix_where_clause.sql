-- =====================================================
-- 최종 수정: WHERE 조건 명확화
-- =====================================================

-- ============================================
-- 1. get_purchases_list 함수 재생성 (WHERE 수정)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_purchases_list(
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
    (get_purchases_list.p_branch_id IS NULL OR p.branch_id = get_purchases_list.p_branch_id)
    AND (get_purchases_list.p_start_date IS NULL OR p.purchase_date >= get_purchases_list.p_start_date)
    AND (get_purchases_list.p_end_date IS NULL OR p.purchase_date <= get_purchases_list.p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;


-- ============================================
-- 2. get_sales_list 함수 재생성 (WHERE 수정)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_sales_list(
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
    (get_sales_list.p_branch_id IS NULL OR s.branch_id = get_sales_list.p_branch_id)
    AND (get_sales_list.p_start_date IS NULL OR s.sale_date >= get_sales_list.p_start_date)
    AND (get_sales_list.p_end_date IS NULL OR s.sale_date <= get_sales_list.p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;


-- ============================================
-- 3. 테스트
-- ============================================
DO $$
DECLARE
    purchase_count INTEGER;
    sales_count INTEGER;
BEGIN
    RAISE NOTICE '=================================';
    RAISE NOTICE '함수 테스트 시작';
    RAISE NOTICE '=================================';
    
    -- purchases 데이터 개수
    SELECT COUNT(*) INTO purchase_count FROM public.purchases;
    RAISE NOTICE 'purchases 테이블 데이터: % 건', purchase_count;
    
    -- sales 데이터 개수
    SELECT COUNT(*) INTO sales_count FROM public.sales;
    RAISE NOTICE 'sales 테이블 데이터: % 건', sales_count;
    
    RAISE NOTICE '=================================';
    RAISE NOTICE '✅ 함수 수정 완료';
    RAISE NOTICE '이제 브라우저에서 확인하세요!';
    RAISE NOTICE '=================================';
END $$;
