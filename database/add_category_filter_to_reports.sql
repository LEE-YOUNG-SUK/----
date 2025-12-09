-- ============================================
-- 레포트 RPC 함수에 카테고리 필터 추가
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 판매/구매/사용/종합 레포트에서 카테고리별 필터링 지원

-- ============================================
-- 1. get_sales_report 함수 수정
-- ============================================
DROP FUNCTION IF EXISTS get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily',
  p_transaction_type TEXT DEFAULT NULL,
  p_category_id TEXT DEFAULT NULL  -- ✅ 카테고리 필터 추가
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  total_quantity NUMERIC,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  total_profit NUMERIC,
  profit_margin NUMERIC,
  transaction_count BIGINT,
  unique_products BIGINT,
  avg_unit_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한별 지점 필터 설정
  IF p_user_role = '0000' THEN
    v_branch_filter := COALESCE(p_branch_id, '');
  ELSE
    v_branch_filter := p_branch_id;
  END IF;

  -- 그룹핑 방식에 따라 다른 쿼리 실행
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT
      s.sale_date::TEXT AS group_key,
      s.sale_date::TEXT AS group_label,
      SUM(s.quantity) AS total_quantity,
      SUM(s.total_price) AS total_revenue,
      SUM(s.cost_of_goods_sold) AS total_cost,
      SUM(s.profit) AS total_profit,
      CASE 
        WHEN SUM(s.total_price) > 0 
        THEN (SUM(s.profit) / SUM(s.total_price) * 100)
        ELSE 0 
      END AS profit_margin,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT s.product_id)::BIGINT AS unique_products,
      AVG(s.unit_price) AS avg_unit_price
    FROM sales s
    LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY s.sale_date
    ORDER BY s.sale_date;

  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM') AS group_key,
      TO_CHAR(s.sale_date, 'YYYY-MM') AS group_label,
      SUM(s.quantity) AS total_quantity,
      SUM(s.total_price) AS total_revenue,
      SUM(s.cost_of_goods_sold) AS total_cost,
      SUM(s.profit) AS total_profit,
      CASE 
        WHEN SUM(s.total_price) > 0 
        THEN (SUM(s.profit) / SUM(s.total_price) * 100)
        ELSE 0 
      END AS profit_margin,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT s.product_id)::BIGINT AS unique_products,
      AVG(s.unit_price) AS avg_unit_price
    FROM sales s
    LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY group_key;

  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT
      s.product_id::TEXT AS group_key,
      MAX(pr.name) AS group_label,
      SUM(s.quantity) AS total_quantity,
      SUM(s.total_price) AS total_revenue,
      SUM(s.cost_of_goods_sold) AS total_cost,
      SUM(s.profit) AS total_profit,
      CASE 
        WHEN SUM(s.total_price) > 0 
        THEN (SUM(s.profit) / SUM(s.total_price) * 100)
        ELSE 0 
      END AS profit_margin,
      COUNT(*)::BIGINT AS transaction_count,
      1::BIGINT AS unique_products,
      AVG(s.unit_price) AS avg_unit_price
    FROM sales s
    LEFT JOIN products pr ON s.product_id = pr.id
    WHERE
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
      AND (p_category_id IS NULL OR p_category_id = '' OR pr.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY s.product_id
    ORDER BY total_revenue DESC;

  ELSIF p_group_by = 'customer' THEN
    RETURN QUERY
    SELECT
      s.client_id::TEXT AS group_key,
      MAX(c.name) AS group_label,
      SUM(s.quantity) AS total_quantity,
      SUM(s.total_price) AS total_revenue,
      SUM(s.cost_of_goods_sold) AS total_cost,
      SUM(s.profit) AS total_profit,
      CASE 
        WHEN SUM(s.total_price) > 0 
        THEN (SUM(s.profit) / SUM(s.total_price) * 100)
        ELSE 0 
      END AS profit_margin,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT s.product_id)::BIGINT AS unique_products,
      AVG(s.unit_price) AS avg_unit_price
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY s.client_id
    ORDER BY total_revenue DESC;

  ELSE
    RAISE EXCEPTION 'Invalid group_by value: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_sales_report IS '판매 레포트 조회 (카테고리 필터 지원)';

-- ============================================
-- 2. get_purchase_report 함수 수정
-- ============================================
DROP FUNCTION IF EXISTS get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_purchase_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily',
  p_category_id TEXT DEFAULT NULL  -- ✅ 카테고리 필터 추가
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  total_quantity NUMERIC,
  total_amount NUMERIC,
  total_tax NUMERIC,
  total_cost NUMERIC,
  transaction_count BIGINT,
  unique_products BIGINT,
  avg_unit_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한별 지점 필터 설정
  IF p_user_role = '0000' THEN
    v_branch_filter := COALESCE(p_branch_id, '');
  ELSE
    v_branch_filter := p_branch_id;
  END IF;

  -- 그룹핑 방식에 따라 다른 쿼리 실행
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT
      pu.purchase_date::TEXT AS group_key,
      pu.purchase_date::TEXT AS group_label,
      SUM(pu.quantity) AS total_quantity,
      SUM(pu.supply_price) AS total_amount,
      SUM(pu.tax_amount) AS total_tax,
      SUM(pu.total_cost) AS total_cost,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT pu.product_id)::BIGINT AS unique_products,
      AVG(pu.unit_cost) AS avg_unit_cost
    FROM purchases pu
    LEFT JOIN products p ON pu.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
      AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY pu.purchase_date
    ORDER BY pu.purchase_date;

  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(pu.purchase_date, 'YYYY-MM') AS group_key,
      TO_CHAR(pu.purchase_date, 'YYYY-MM') AS group_label,
      SUM(pu.quantity) AS total_quantity,
      SUM(pu.supply_price) AS total_amount,
      SUM(pu.tax_amount) AS total_tax,
      SUM(pu.total_cost) AS total_cost,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT pu.product_id)::BIGINT AS unique_products,
      AVG(pu.unit_cost) AS avg_unit_cost
    FROM purchases pu
    LEFT JOIN products p ON pu.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
      AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY TO_CHAR(pu.purchase_date, 'YYYY-MM')
    ORDER BY group_key;

  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT
      pu.product_id::TEXT AS group_key,
      MAX(pr.name) AS group_label,
      SUM(pu.quantity) AS total_quantity,
      SUM(pu.supply_price) AS total_amount,
      SUM(pu.tax_amount) AS total_tax,
      SUM(pu.total_cost) AS total_cost,
      COUNT(*)::BIGINT AS transaction_count,
      1::BIGINT AS unique_products,
      AVG(pu.unit_cost) AS avg_unit_cost
    FROM purchases pu
    LEFT JOIN products pr ON pu.product_id = pr.id
    WHERE
      (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
      AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_category_id IS NULL OR p_category_id = '' OR pr.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY pu.product_id
    ORDER BY total_amount DESC;

  ELSIF p_group_by = 'supplier' THEN
    RETURN QUERY
    SELECT
      pu.supplier_id::TEXT AS group_key,
      MAX(sup.name) AS group_label,
      SUM(pu.quantity) AS total_quantity,
      SUM(pu.supply_price) AS total_amount,
      SUM(pu.tax_amount) AS total_tax,
      SUM(pu.total_cost) AS total_cost,
      COUNT(*)::BIGINT AS transaction_count,
      COUNT(DISTINCT pu.product_id)::BIGINT AS unique_products,
      AVG(pu.unit_cost) AS avg_unit_cost
    FROM purchases pu
    LEFT JOIN clients sup ON pu.supplier_id = sup.id
    LEFT JOIN products p ON pu.product_id = p.id  -- ✅ products 조인
    WHERE
      (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
      AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
    GROUP BY pu.supplier_id
    ORDER BY total_amount DESC;

  ELSE
    RAISE EXCEPTION 'Invalid group_by value: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_purchase_report IS '구매 레포트 조회 (카테고리 필터 지원)';

-- ============================================
-- 3. get_summary_report 함수 수정
-- ============================================
DROP FUNCTION IF EXISTS get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_summary_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily',
  p_category_id TEXT DEFAULT NULL  -- ✅ 카테고리 필터 추가
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  purchase_amount NUMERIC,
  usage_amount NUMERIC,
  sale_amount NUMERIC,
  sale_cost NUMERIC,
  sale_profit NUMERIC,
  profit_margin NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한별 지점 필터 설정
  IF p_user_role = '0000' THEN
    v_branch_filter := COALESCE(p_branch_id, '');
  ELSE
    v_branch_filter := p_branch_id;
  END IF;

  -- 그룹핑 방식에 따라 다른 쿼리 실행
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    WITH purchase_data AS (
      SELECT
        pu.purchase_date::TEXT AS period_key,
        SUM(pu.total_cost) AS total_amount
      FROM purchases pu
      LEFT JOIN products p ON pu.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
        AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY pu.purchase_date
    ),
    usage_data AS (
      SELECT
        s.sale_date::TEXT AS period_key,
        SUM(s.cost_of_goods_sold) AS total_amount
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
        AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND COALESCE(s.transaction_type, 'SALE') = 'USAGE'
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY s.sale_date
    ),
    sale_data AS (
      SELECT
        s.sale_date::TEXT AS period_key,
        SUM(s.total_price) AS total_revenue,
        SUM(s.cost_of_goods_sold) AS total_cost,
        SUM(s.profit) AS total_profit
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
        AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND COALESCE(s.transaction_type, 'SALE') = 'SALE'
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY s.sale_date
    ),
    all_periods AS (
      SELECT DISTINCT period_key FROM purchase_data
      UNION
      SELECT DISTINCT period_key FROM usage_data
      UNION
      SELECT DISTINCT period_key FROM sale_data
    )
    SELECT
      ap.period_key AS group_key,
      ap.period_key AS group_label,
      COALESCE(pd.total_amount, 0) AS purchase_amount,
      COALESCE(ud.total_amount, 0) AS usage_amount,
      COALESCE(sd.total_revenue, 0) AS sale_amount,
      COALESCE(sd.total_cost, 0) AS sale_cost,
      COALESCE(sd.total_profit, 0) AS sale_profit,
      CASE
        WHEN COALESCE(sd.total_revenue, 0) > 0
        THEN (COALESCE(sd.total_profit, 0) / sd.total_revenue * 100)
        ELSE 0
      END AS profit_margin
    FROM all_periods ap
    LEFT JOIN purchase_data pd ON ap.period_key = pd.period_key
    LEFT JOIN usage_data ud ON ap.period_key = ud.period_key
    LEFT JOIN sale_data sd ON ap.period_key = sd.period_key
    ORDER BY ap.period_key;

  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    WITH purchase_data AS (
      SELECT
        TO_CHAR(pu.purchase_date, 'YYYY-MM') AS period_key,
        SUM(pu.total_cost) AS total_amount
      FROM purchases pu
      LEFT JOIN products p ON pu.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR pu.branch_id::TEXT = v_branch_filter)
        AND pu.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY TO_CHAR(pu.purchase_date, 'YYYY-MM')
    ),
    usage_data AS (
      SELECT
        TO_CHAR(s.sale_date, 'YYYY-MM') AS period_key,
        SUM(s.cost_of_goods_sold) AS total_amount
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
        AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND COALESCE(s.transaction_type, 'SALE') = 'USAGE'
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ),
    sale_data AS (
      SELECT
        TO_CHAR(s.sale_date, 'YYYY-MM') AS period_key,
        SUM(s.total_price) AS total_revenue,
        SUM(s.cost_of_goods_sold) AS total_cost,
        SUM(s.profit) AS total_profit
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id  -- ✅ products 조인
      WHERE
        (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
        AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
        AND COALESCE(s.transaction_type, 'SALE') = 'SALE'
        AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)  -- ✅ 카테고리 필터
      GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ),
    all_periods AS (
      SELECT DISTINCT period_key FROM purchase_data
      UNION
      SELECT DISTINCT period_key FROM usage_data
      UNION
      SELECT DISTINCT period_key FROM sale_data
    )
    SELECT
      ap.period_key AS group_key,
      ap.period_key AS group_label,
      COALESCE(pd.total_amount, 0) AS purchase_amount,
      COALESCE(ud.total_amount, 0) AS usage_amount,
      COALESCE(sd.total_revenue, 0) AS sale_amount,
      COALESCE(sd.total_cost, 0) AS sale_cost,
      COALESCE(sd.total_profit, 0) AS sale_profit,
      CASE
        WHEN COALESCE(sd.total_revenue, 0) > 0
        THEN (COALESCE(sd.total_profit, 0) / sd.total_revenue * 100)
        ELSE 0
      END AS profit_margin
    FROM all_periods ap
    LEFT JOIN purchase_data pd ON ap.period_key = pd.period_key
    LEFT JOIN usage_data ud ON ap.period_key = ud.period_key
    LEFT JOIN sale_data sd ON ap.period_key = sd.period_key
    ORDER BY ap.period_key;

  ELSE
    RAISE EXCEPTION 'Invalid group_by value: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_summary_report IS '종합 레포트 조회 (카테고리 필터 지원)';

-- ============================================
-- 확인
-- ============================================
SELECT '✅ 레포트 RPC 함수에 카테고리 필터 추가 완료!' AS status;

-- 함수 목록 확인
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_sales_report', 'get_purchase_report', 'get_summary_report')
ORDER BY routine_name;

