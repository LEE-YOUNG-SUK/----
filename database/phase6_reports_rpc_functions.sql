-- ============================================================
-- Phase 6: Reports System - RPC Functions
-- ============================================================
-- 작성일: 2025-01-26
-- 목적: 구매/판매/이익 레포트 조회를 위한 Supabase RPC 함수 구현
-- 핵심 원칙:
-- 1. UUID::TEXT 캐스팅 필수 (WHERE 절, SELECT 절)
-- 2. COALESCE 사용 (NULL 안전성)
-- 3. 명시적 타입 변환 (::TEXT, ::NUMERIC, ::INTEGER)
-- 4. 권한 체크: 원장(0001)/매니저(0002) 이상만 접근 가능
-- ============================================================

-- ============================================================
-- 1. 구매 레포트 (Purchase Report)
-- ============================================================
-- 기능: 기간별/그룹별 구매 현황 집계
-- 그룹핑: daily(일별), monthly(월별), product(품목별), supplier(공급처별)
-- 권한: 0001(원장), 0002(매니저) 이상
-- ============================================================

DROP FUNCTION IF EXISTS get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_purchase_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'  -- 'daily', 'monthly', 'product', 'supplier'
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  total_quantity NUMERIC,
  total_amount NUMERIC,
  transaction_count INTEGER,
  average_unit_cost NUMERIC,
  product_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한 체크: 원장(0001)/매니저(0002) 이상만 접근 가능
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다. (권한: %)', p_user_role;
  END IF;
  
  -- 지점 필터 설정
  v_branch_filter := COALESCE(p_branch_id, '');
  
  -- 일별 그룹핑
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,
      TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,
      COALESCE(SUM(p.quantity), 0)::NUMERIC,
      COALESCE(SUM(p.total_cost), 0)::NUMERIC,
      COUNT(DISTINCT p.id)::INTEGER,
      CASE 
        WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT p.product_id)::INTEGER
    FROM purchases p
    WHERE 
      (v_branch_filter = '' OR p.branch_id::TEXT = v_branch_filter)
      AND p.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM-DD')
    ORDER BY 1 DESC;
  
  -- 월별 그룹핑
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(p.purchase_date, 'YYYY-MM')::TEXT,
      TO_CHAR(p.purchase_date, 'YYYY-MM')::TEXT,
      COALESCE(SUM(p.quantity), 0)::NUMERIC,
      COALESCE(SUM(p.total_cost), 0)::NUMERIC,
      COUNT(DISTINCT p.id)::INTEGER,
      CASE 
        WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT p.product_id)::INTEGER
    FROM purchases p
    WHERE 
      (v_branch_filter = '' OR p.branch_id::TEXT = v_branch_filter)
      AND p.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM')
    ORDER BY 1 DESC;
  
  -- 품목별 그룹핑
  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT
      p.product_id::TEXT AS group_key,
      prod.name::TEXT AS group_label,
      COALESCE(SUM(p.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(p.total_cost), 0)::NUMERIC AS total_amount,
      COUNT(DISTINCT p.id)::INTEGER AS transaction_count,
      CASE 
        WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END AS average_unit_cost,
      1::INTEGER AS product_count
    FROM purchases p
    INNER JOIN products prod ON prod.id = p.product_id
    WHERE 
      (v_branch_filter = '' OR p.branch_id::TEXT = v_branch_filter)
      AND p.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY p.product_id, prod.name
    ORDER BY total_amount DESC;
  
  -- 공급처별 그룹핑
  ELSIF p_group_by = 'supplier' THEN
    RETURN QUERY
    SELECT
      p.client_id::TEXT,
      c.name::TEXT,
      COALESCE(SUM(p.quantity), 0)::NUMERIC,
      COALESCE(SUM(p.total_cost), 0)::NUMERIC,
      COUNT(DISTINCT p.id)::INTEGER,
      CASE 
        WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT p.product_id)::INTEGER
    FROM purchases p
    INNER JOIN clients c ON c.id = p.client_id
    WHERE 
      (v_branch_filter = '' OR p.branch_id::TEXT = v_branch_filter)
      AND p.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY p.client_id, c.name
    ORDER BY 4 DESC;
  
  ELSE
    RAISE EXCEPTION '지원하지 않는 그룹핑 방식입니다: %', p_group_by;
  END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_purchase_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_purchase_report IS 'Phase 6: 구매 레포트 조회 (일별/월별/품목별/공급처별) - 원장/매니저 이상';


-- ============================================================
-- 2. 판매 레포트 (Sales Report)
-- ============================================================
-- 기능: 기간별/그룹별 판매 현황 집계 (내부 사용 포함)
-- 그룹핑: daily(일별), monthly(월별), product(품목별), customer(고객별)
-- 권한: 0001(원장), 0002(매니저) 이상
-- 참고: 내부 사용(unit_price=0) 데이터도 포함 집계
-- ============================================================

DROP FUNCTION IF EXISTS get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'
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
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다. (권한: %)', p_user_role;
  END IF;
  
  v_branch_filter := COALESCE(p_branch_id, '');
  
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
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM-DD')
    ORDER BY 1 DESC;
  
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
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY 1 DESC;
  
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
    GROUP BY s.product_id, prod.name
    ORDER BY 4 DESC;
  
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
    GROUP BY s.client_id, c.name
    ORDER BY 4 DESC;
  
  ELSE
    RAISE EXCEPTION '지원하지 않는 그룹핑 방식입니다: %', p_group_by;
  END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_sales_report IS 'Phase 6: 판매 레포트 조회 (일별/월별/품목별/고객별) - 원장/매니저 이상';


-- ============================================================
-- 3. 이익 레포트 (Profit Report)
-- ============================================================
-- 기능: 기간별 이익 현황 집계 (매출-원가=이익)
-- 그룹핑: daily(일별), monthly(월별)
-- 권한: 0001(원장), 0002(매니저) 이상
-- 참고: sales 테이블의 profit 컬럼 직접 집계
-- ============================================================

DROP FUNCTION IF EXISTS get_profit_report(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_profit_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  total_revenue NUMERIC,
  total_cost NUMERIC,
  total_profit NUMERIC,
  profit_margin NUMERIC,
  transaction_count INTEGER,
  product_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다. (권한: %)', p_user_role;
  END IF;
  
  v_branch_filter := COALESCE(p_branch_id, '');
  
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM-DD')::TEXT,
      TO_CHAR(s.sale_date, 'YYYY-MM-DD')::TEXT,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      CASE 
        WHEN SUM(s.total_price) > 0 THEN ((SUM(s.profit) / SUM(s.total_price)) * 100)::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT s.id)::INTEGER,
      COUNT(DISTINCT s.product_id)::INTEGER
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM-DD')
    ORDER BY 1 DESC;
  
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM')::TEXT,
      TO_CHAR(s.sale_date, 'YYYY-MM')::TEXT,
      COALESCE(SUM(s.total_price), 0)::NUMERIC,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC,
      COALESCE(SUM(s.profit), 0)::NUMERIC,
      CASE 
        WHEN SUM(s.total_price) > 0 THEN ((SUM(s.profit) / SUM(s.total_price)) * 100)::NUMERIC
        ELSE 0::NUMERIC
      END,
      COUNT(DISTINCT s.id)::INTEGER,
      COUNT(DISTINCT s.product_id)::INTEGER
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY 1 DESC;
  
  ELSE
    RAISE EXCEPTION '지원하지 않는 그룹핑 방식입니다: %', p_group_by;
  END IF;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_profit_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profit_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_profit_report IS 'Phase 6: 이익 레포트 조회 (일별/월별) - 원장/매니저 이상';


-- ============================================================
-- 배포 가이드
-- ============================================================
-- 1. Supabase SQL Editor에서 이 파일 전체 실행
-- 2. 기존 함수가 있으면 DROP 후 재생성
-- 3. GRANT 권한 확인 (authenticated, anon)
-- 4. 테스트 쿼리 실행:
--    SELECT * FROM get_purchase_report('0001', NULL, '2024-01-01', '2024-12-31', 'monthly');
--    SELECT * FROM get_sales_report('0001', NULL, '2024-01-01', '2024-12-31', 'monthly');
--    SELECT * FROM get_profit_report('0001', NULL, '2024-01-01', '2024-12-31', 'monthly');
-- 5. 오류 발생 시 database/PHASE5_HANDOVER.md 참고 (디버깅 가이드)
-- ============================================================
