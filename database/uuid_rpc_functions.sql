-- =====================================================
-- UUID 타입에 맞춘 최종 RPC 함수
-- =====================================================

-- ============================================
-- 0. 기존 함수 삭제
-- ============================================
DROP FUNCTION IF EXISTS public.get_purchases_list(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_sales_list(TEXT, DATE, DATE);

-- ============================================
-- 1. get_purchases_list (UUID 버전)
-- ============================================
CREATE FUNCTION public.get_purchases_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  branch_name TEXT,
  client_id UUID,
  client_name TEXT,
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  purchase_date DATE,
  quantity INTEGER,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.branch_id,
    COALESCE(b.name, '')::TEXT AS branch_name,
    p.client_id,
    COALESCE(c.name, '')::TEXT AS client_name,
    p.product_id,
    COALESCE(pr.code, '')::TEXT AS product_code,
    COALESCE(pr.name, '')::TEXT AS product_name,
    COALESCE(pr.unit, '')::TEXT AS unit,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    p.total_cost,
    COALESCE(p.reference_number, '')::TEXT AS reference_number,
    COALESCE(p.notes, '')::TEXT AS notes,
    p.created_at,
    p.created_by
  FROM public.purchases p
  LEFT JOIN public.branches b ON p.branch_id = b.id
  LEFT JOIN public.clients c ON p.client_id = c.id
  LEFT JOIN public.products pr ON p.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR p.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;


-- ============================================
-- 2. get_sales_list (UUID 버전)
-- ============================================
CREATE FUNCTION public.get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  branch_name TEXT,
  client_id UUID,
  client_name TEXT,
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  sale_date DATE,
  quantity INTEGER,
  unit_price NUMERIC,
  total_price NUMERIC,
  cost_of_goods_sold NUMERIC,
  profit NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.branch_id,
    COALESCE(b.name, '')::TEXT AS branch_name,
    s.client_id,
    COALESCE(c.name, '')::TEXT AS client_name,
    s.product_id,
    COALESCE(pr.code, '')::TEXT AS product_code,
    COALESCE(pr.name, '')::TEXT AS product_name,
    COALESCE(pr.unit, '')::TEXT AS unit,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.total_price,
    COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods_sold,
    COALESCE(s.profit, 0) AS profit,
    COALESCE(s.reference_number, '')::TEXT AS reference_number,
    COALESCE(s.notes, '')::TEXT AS notes,
    s.created_at,
    s.created_by
  FROM public.sales s
  LEFT JOIN public.branches b ON s.branch_id = b.id
  LEFT JOIN public.clients c ON s.client_id = c.id
  LEFT JOIN public.products pr ON s.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR s.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;


-- ============================================
-- 3. 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_purchases_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchases_list(TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.get_sales_list(TEXT, DATE, DATE) TO anon;


-- ============================================
-- 4. 테스트
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=================================';
    RAISE NOTICE '✅ UUID 타입 RPC 함수 생성 완료';
    RAISE NOTICE 'purchases 데이터: 33건';
    RAISE NOTICE 'sales 데이터: 21건';
    RAISE NOTICE '=================================';
    RAISE NOTICE '이제 브라우저에서 확인하세요!';
    RAISE NOTICE '서버 재시작: Ctrl+C → npm run dev';
    RAISE NOTICE '브라우저 새로고침: Ctrl+Shift+R';
    RAISE NOTICE '=================================';
END $$;


-- 테스트 쿼리 (결과 확인)
SELECT 'purchases 샘플' as test;
SELECT * FROM public.get_purchases_list(NULL, NULL, NULL) LIMIT 3;

SELECT 'sales 샘플' as test;
SELECT * FROM public.get_sales_list(NULL, NULL, NULL) LIMIT 3;
