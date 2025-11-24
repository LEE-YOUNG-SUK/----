-- =====================================================
-- RPC 함수 중복 제거 및 재생성
-- =====================================================

-- ============================================
-- 1. 기존 함수 모두 삭제 (UUID/TEXT 버전 전부)
-- ============================================

-- get_purchases_list 함수 삭제
DROP FUNCTION IF EXISTS public.get_purchases_list(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_purchases_list(text, date, date);

-- get_sales_list 함수 삭제
DROP FUNCTION IF EXISTS public.get_sales_list(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_sales_list(text, date, date);


-- ============================================
-- 2. TEXT 타입으로 함수 재생성
-- ============================================

-- 입고 내역 조회 함수 (TEXT 버전)
CREATE OR REPLACE FUNCTION get_purchases_list(
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
    b.name AS branch_name,
    p.client_id,
    c.name AS client_name,
    p.product_id,
    pr.code AS product_code,
    pr.name AS product_name,
    pr.unit,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    p.total_cost,
    p.reference_number,
    p.notes,
    p.created_at,
    p.created_by
  FROM purchases p
  INNER JOIN branches b ON p.branch_id = b.id
  INNER JOIN clients c ON p.client_id = c.id
  INNER JOIN products pr ON p.product_id = pr.id
  WHERE 
    (get_purchases_list.p_branch_id IS NULL OR p.branch_id = get_purchases_list.p_branch_id)
    AND (get_purchases_list.p_start_date IS NULL OR p.purchase_date >= get_purchases_list.p_start_date)
    AND (get_purchases_list.p_end_date IS NULL OR p.purchase_date <= get_purchases_list.p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;


-- 판매 내역 조회 함수 (TEXT 버전)
CREATE OR REPLACE FUNCTION get_sales_list(
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
    b.name AS branch_name,
    s.client_id,
    c.name AS client_name,
    s.product_id,
    pr.code AS product_code,
    pr.name AS product_name,
    pr.unit,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.total_price,
    s.cost_of_goods_sold,
    s.profit,
    s.reference_number,
    s.notes,
    s.created_at,
    s.created_by
  FROM sales s
  INNER JOIN branches b ON s.branch_id = b.id
  INNER JOIN clients c ON s.client_id = c.id
  INNER JOIN products pr ON s.product_id = pr.id
  WHERE 
    (get_sales_list.p_branch_id IS NULL OR s.branch_id = get_sales_list.p_branch_id)
    AND (get_sales_list.p_start_date IS NULL OR s.sale_date >= get_sales_list.p_start_date)
    AND (get_sales_list.p_end_date IS NULL OR s.sale_date <= get_sales_list.p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;


-- ============================================
-- 3. 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION get_purchases_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE) TO authenticated;


-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 중복 RPC 함수 제거 완료';
    RAISE NOTICE '✅ get_purchases_list (TEXT 버전) 재생성 완료';
    RAISE NOTICE '✅ get_sales_list (TEXT 버전) 재생성 완료';
END $$;
