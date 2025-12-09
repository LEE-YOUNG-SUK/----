-- ============================================
-- 입고/판매 내역 조회에 담당자 이름 추가
-- ============================================
-- 작성일: 2025-12-09
-- 목적: 상세보기 모달에 담당자 이름 표시

-- ============================================
-- 1. 기존 함수 삭제
-- ============================================
DROP FUNCTION IF EXISTS get_purchases_list(TEXT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE) CASCADE;

-- ============================================
-- 2. 입고 내역 조회 함수 (담당자 이름 추가)
-- ============================================
CREATE OR REPLACE FUNCTION get_purchases_list(
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
  quantity NUMERIC,
  unit_cost NUMERIC,
  supply_price NUMERIC,
  tax_amount NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  created_by_name TEXT  -- ✅ 담당자 이름 추가
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
    b.name::TEXT AS branch_name,
    p.client_id::UUID,
    COALESCE(c.name, '')::TEXT AS client_name,
    p.product_id::UUID,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    COALESCE(p.supply_price, 0)::NUMERIC AS supply_price,
    COALESCE(p.tax_amount, 0)::NUMERIC AS tax_amount,
    p.total_cost,
    COALESCE(p.reference_number, '')::TEXT AS reference_number,
    COALESCE(p.notes, '')::TEXT AS notes,
    p.created_at,
    p.created_by::UUID,
    COALESCE(u.display_name, u.username, '알 수 없음')::TEXT AS created_by_name  -- ✅ users 테이블 JOIN
  FROM purchases p
  INNER JOIN branches b ON p.branch_id = b.id
  LEFT JOIN clients c ON p.client_id = c.id  -- LEFT JOIN (공급업체 없을 수 있음)
  INNER JOIN products pr ON p.product_id = pr.id
  LEFT JOIN users u ON p.created_by = u.id  -- ✅ 담당자 이름 JOIN
  WHERE 
    (p_branch_id IS NULL OR p.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_purchases_list(TEXT, DATE, DATE) IS '입고 내역 조회 - 담당자 이름 포함';

-- ============================================
-- 3. 판매 내역 조회 함수 (담당자 이름 추가)
-- ============================================
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  branch_name TEXT,
  client_id UUID,
  customer_name TEXT,
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  sale_date DATE,
  quantity NUMERIC,
  unit_price NUMERIC,
  supply_price NUMERIC,
  tax_amount NUMERIC,
  total_price NUMERIC,
  cost_of_goods_sold NUMERIC,
  profit NUMERIC,
  reference_number TEXT,
  notes TEXT,
  transaction_type TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  created_by_name TEXT  -- ✅ 담당자 이름 추가
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
    b.name::TEXT AS branch_name,
    s.client_id::UUID,
    COALESCE(c.name, '')::TEXT AS customer_name,
    s.product_id::UUID,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT,
    s.sale_date,
    s.quantity,
    s.unit_price,
    COALESCE(s.supply_price, 0)::NUMERIC AS supply_price,
    COALESCE(s.tax_amount, 0)::NUMERIC AS tax_amount,
    s.total_price,
    COALESCE(s.cost_of_goods_sold, 0)::NUMERIC AS cost_of_goods_sold,
    COALESCE(s.profit, 0)::NUMERIC AS profit,
    COALESCE(s.reference_number, '')::TEXT AS reference_number,
    COALESCE(s.notes, '')::TEXT AS notes,
    COALESCE(s.transaction_type, 'SALE')::TEXT AS transaction_type,
    s.created_at,
    s.created_by::UUID,
    COALESCE(u.display_name, u.username, '알 수 없음')::TEXT AS created_by_name  -- ✅ users 테이블 JOIN
  FROM sales s
  INNER JOIN branches b ON s.branch_id = b.id
  LEFT JOIN clients c ON s.client_id = c.id  -- LEFT JOIN (고객 없을 수 있음)
  INNER JOIN products pr ON s.product_id = pr.id
  LEFT JOIN users u ON s.created_by = u.id  -- ✅ 담당자 이름 JOIN
  WHERE 
    (p_branch_id IS NULL OR s.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_sales_list(TEXT, DATE, DATE) IS '판매 내역 조회 - 담당자 이름 포함';

-- ============================================
-- 4. 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION get_purchases_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE) TO authenticated;

-- ============================================
-- 5. 검증
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 입고/판매 내역 조회 함수에 담당자 이름 추가 완료!';
  RAISE NOTICE '   - get_purchases_list: created_by_name 컬럼 추가';
  RAISE NOTICE '   - get_sales_list: created_by_name 컬럼 추가';
END $$;

-- 테스트 쿼리
SELECT 
  reference_number, 
  product_name, 
  created_by_name  -- ✅ 담당자 이름 확인
FROM get_purchases_list(NULL, NULL, NULL) 
LIMIT 5;

SELECT 
  reference_number, 
  product_name, 
  created_by_name  -- ✅ 담당자 이름 확인
FROM get_sales_list(NULL, NULL, NULL) 
LIMIT 5;
