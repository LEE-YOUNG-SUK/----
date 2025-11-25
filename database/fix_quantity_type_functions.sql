-- =====================================================
-- 구매/판매 목록 RPC 함수 컬럼 타입 불일치 수정
-- 콘솔 오류: Returned type integer does not match expected type numeric in column 11
-- 원인: 기존 캐시된 함수 정의에서 quantity NUMERIC, SELECT는 INTEGER → 타입 불일치
-- 해결: 함수 재생성 (DROP 후 CREATE) + 모든 SELECT 컬럼 명시적 캐스팅
-- 실행 후: 브라우저 강력 새로고침(Ctrl+Shift+R) 또는 dev 서버 재시작
-- =====================================================

-- 0. 기존 함수 제거 (같은 파라미터 시그니처)
DROP FUNCTION IF EXISTS public.get_purchases_list(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_sales_list(TEXT, DATE, DATE);

-- 1. 구매 목록 함수 재생성
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
  quantity INTEGER,          -- INTEGER로 명확화
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::UUID,
    p.branch_id::UUID,
    COALESCE(b.name, '')::TEXT AS branch_name,
    p.client_id::UUID,
    COALESCE(c.name, '')::TEXT AS client_name,
    p.product_id::UUID,
    COALESCE(pr.code, '')::TEXT AS product_code,
    COALESCE(pr.name, '')::TEXT AS product_name,
    COALESCE(pr.unit, '')::TEXT AS unit,
    p.purchase_date::DATE,
    p.quantity::INTEGER,
    p.unit_cost::NUMERIC,
    p.total_cost::NUMERIC,
    COALESCE(p.reference_number, '')::TEXT AS reference_number,
    COALESCE(p.notes, '')::TEXT AS notes,
    p.created_at,
    p.created_by::UUID
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

-- 2. 판매 목록 함수 재생성
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
  quantity INTEGER,          -- INTEGER 확정
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id::UUID,
    s.branch_id::UUID,
    COALESCE(b.name, '')::TEXT AS branch_name,
    s.client_id::UUID,
    COALESCE(c.name, '')::TEXT AS client_name,
    s.product_id::UUID,
    COALESCE(pr.code, '')::TEXT AS product_code,
    COALESCE(pr.name, '')::TEXT AS product_name,
    COALESCE(pr.unit, '')::TEXT AS unit,
    s.sale_date::DATE,
    s.quantity::INTEGER,
    s.unit_price::NUMERIC,
    s.total_price::NUMERIC,
    COALESCE(s.cost_of_goods_sold, 0)::NUMERIC AS cost_of_goods_sold,
    COALESCE(s.profit, 0)::NUMERIC AS profit,
    COALESCE(s.reference_number, '')::TEXT AS reference_number,
    COALESCE(s.notes, '')::TEXT AS notes,
    s.created_at,
    s.created_by::UUID
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

-- 3. 권한 재부여
GRANT EXECUTE ON FUNCTION public.get_purchases_list(TEXT, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_list(TEXT, DATE, DATE) TO authenticated, anon;

-- 4. 캐시/정의 확인
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ 목록 RPC 함수 재생성 완료 (quantity INTEGER)';
  RAISE NOTICE '브라우저 강력 새로고침(Ctrl+Shift+R) 후 재확인하세요.';
  RAISE NOTICE '필요시 dev 서버 재시작 npm run dev';
  RAISE NOTICE '============================================';
END $$;

-- 5. 테스트 샘플
SELECT 'purchases sample' AS label, * FROM public.get_purchases_list(NULL,NULL,NULL) LIMIT 1;
SELECT 'sales sample' AS label, * FROM public.get_sales_list(NULL,NULL,NULL) LIMIT 1;
