-- ============================================================
-- get_sales_report 함수에 transaction_type 필터 추가
-- ============================================================
-- 작성일: 2025-01-26
-- 목적: 판매 레포트에서 SALE만 집계 (USAGE 제외)

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- 새 함수 생성 (transaction_type 필터 추가)
CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily',
  p_transaction_type TEXT DEFAULT 'SALE'  -- ✅ 추가: 기본값 SALE
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  total_quantity NUMERIC,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  total_profit NUMERIC,
  transaction_count INTEGER,
  average_unit_price NUMERIC,
  product_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한 체크
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다. (권한: %)', p_user_role;
  END IF;
  
  v_branch_filter := COALESCE(p_branch_id, '');
  
  -- 일별 그룹핑
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM-DD')::TEXT,
      TO_CHAR(s.sale_date, 'YYYY-MM-DD')::TEXT,
      COALESCE(SUM(s.quantity), 0)::NUMERIC,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      COUNT(DISTINCT s.id)::INTEGER,
      CASE 
        WHEN SUM(s.quantity) > 0 THEN (SUM(s.total_price) / SUM(s.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT s.product_id)::INTEGER
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = p_transaction_type  -- ✅ 추가
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM-DD')
    ORDER BY 1 DESC;
  
  -- 월별 그룹핑
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM')::TEXT,
      TO_CHAR(s.sale_date, 'YYYY-MM')::TEXT,
      COALESCE(SUM(s.quantity), 0)::NUMERIC,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      COUNT(DISTINCT s.id)::INTEGER,
      CASE 
        WHEN SUM(s.quantity) > 0 THEN (SUM(s.total_price) / SUM(s.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT s.product_id)::INTEGER
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = p_transaction_type  -- ✅ 추가
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY 1 DESC;
  
  -- 품목별 그룹핑
  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT
      s.product_id::TEXT,
      prod.name::TEXT,
      COALESCE(SUM(s.quantity), 0)::NUMERIC,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      COUNT(DISTINCT s.id)::INTEGER,
      CASE 
        WHEN SUM(s.quantity) > 0 THEN (SUM(s.total_price) / SUM(s.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      1::INTEGER
    FROM sales s
    INNER JOIN products prod ON prod.id = s.product_id
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = p_transaction_type  -- ✅ 추가
    GROUP BY s.product_id, prod.name
    ORDER BY 4 DESC;
  
  -- 고객별 그룹핑
  ELSIF p_group_by = 'customer' THEN
    RETURN QUERY
    SELECT
      s.client_id::TEXT,
      c.name::TEXT,
      COALESCE(SUM(s.quantity), 0)::NUMERIC,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      COUNT(DISTINCT s.id)::INTEGER,
      CASE 
        WHEN SUM(s.quantity) > 0 THEN (SUM(s.total_price) / SUM(s.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT s.product_id)::INTEGER
    FROM sales s
    INNER JOIN clients c ON c.id = s.client_id
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = p_transaction_type  -- ✅ 추가
    GROUP BY s.client_id, c.name
    ORDER BY 4 DESC;
  
  ELSE
    RAISE EXCEPTION '지원하지 않는 그룹핑 방식입니다: %', p_group_by;
  END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_sales_report IS '판매 레포트 조회 (일별/월별/품목별/고객별) - transaction_type 필터 지원';

-- 확인
SELECT '✅ get_sales_report 함수 수정 완료 (transaction_type 필터 추가)' AS status;

