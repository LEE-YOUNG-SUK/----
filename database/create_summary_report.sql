-- ============================================
-- 종합 레포트 RPC 함수
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 구매/사용/판매를 한번에 조회하는 통합 레포트

DROP FUNCTION IF EXISTS get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_summary_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'  -- 'daily' 또는 'monthly'
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  purchase_amount NUMERIC,      -- 구매금액
  usage_amount NUMERIC,         -- 사용금액 (내부소모)
  sale_amount NUMERIC,          -- 판매금액
  sale_cost NUMERIC,            -- 판매원가
  sale_profit NUMERIC,          -- 판매이익
  profit_margin NUMERIC         -- 이익률 (%)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
  v_date_format TEXT;
BEGIN
  -- 권한 체크
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다. (권한: %)', p_user_role;
  END IF;
  
  v_branch_filter := COALESCE(p_branch_id, '');
  
  -- 그룹핑 형식 결정
  IF p_group_by = 'monthly' THEN
    v_date_format := 'YYYY-MM';
  ELSE
    v_date_format := 'YYYY-MM-DD';
  END IF;

  RETURN QUERY
  WITH 
  -- 구매 데이터 집계
  purchase_data AS (
    SELECT 
      TO_CHAR(p.purchase_date, v_date_format) AS period,
      COALESCE(SUM(p.total_cost), 0) AS total_amount
    FROM purchases p
    WHERE 
      (v_branch_filter = '' OR p.branch_id::TEXT = v_branch_filter)
      AND p.purchase_date BETWEEN p_start_date::DATE AND p_end_date::DATE
    GROUP BY TO_CHAR(p.purchase_date, v_date_format)
  ),
  -- 사용(USAGE) 데이터 집계
  usage_data AS (
    SELECT 
      TO_CHAR(s.sale_date, v_date_format) AS period,
      COALESCE(SUM(s.total_price), 0) AS total_amount
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = 'USAGE'
    GROUP BY TO_CHAR(s.sale_date, v_date_format)
  ),
  -- 판매(SALE) 데이터 집계
  sale_data AS (
    SELECT 
      TO_CHAR(s.sale_date, v_date_format) AS period,
      COALESCE(SUM(s.total_price), 0) AS sale_amount,
      COALESCE(SUM(s.cost_of_goods_sold), 0) AS sale_cost,
      COALESCE(SUM(s.profit), 0) AS sale_profit
    FROM sales s
    WHERE 
      (v_branch_filter = '' OR s.branch_id::TEXT = v_branch_filter)
      AND s.sale_date BETWEEN p_start_date::DATE AND p_end_date::DATE
      AND COALESCE(s.transaction_type, 'SALE') = 'SALE'
    GROUP BY TO_CHAR(s.sale_date, v_date_format)
  ),
  -- 모든 기간 통합
  all_periods AS (
    SELECT period FROM purchase_data
    UNION
    SELECT period FROM usage_data
    UNION
    SELECT period FROM sale_data
  )
  -- 최종 결과
  SELECT 
    ap.period::TEXT AS group_key,
    ap.period::TEXT AS group_label,
    COALESCE(pd.total_amount, 0)::NUMERIC AS purchase_amount,
    COALESCE(ud.total_amount, 0)::NUMERIC AS usage_amount,
    COALESCE(sd.sale_amount, 0)::NUMERIC AS sale_amount,
    COALESCE(sd.sale_cost, 0)::NUMERIC AS sale_cost,
    COALESCE(sd.sale_profit, 0)::NUMERIC AS sale_profit,
    CASE 
      WHEN COALESCE(sd.sale_amount, 0) > 0 
      THEN ROUND((COALESCE(sd.sale_profit, 0) / sd.sale_amount) * 100, 2)
      ELSE 0
    END::NUMERIC AS profit_margin
  FROM all_periods ap
  LEFT JOIN purchase_data pd ON ap.period = pd.period
  LEFT JOIN usage_data ud ON ap.period = ud.period
  LEFT JOIN sale_data sd ON ap.period = sd.period
  ORDER BY ap.period DESC;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_summary_report(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_summary_report IS '종합 레포트 - 구매/사용/판매 통합 조회 (일별/월별)';

-- 확인
SELECT '✅ get_summary_report 함수 생성 완료!' AS status;

-- 테스트 쿼리
SELECT * FROM get_summary_report(
  '0000',  -- user_role
  '',      -- branch_id (전체)
  (CURRENT_DATE - INTERVAL '30 days')::TEXT,  -- start_date
  CURRENT_DATE::TEXT,  -- end_date
  'daily'  -- group_by
)
LIMIT 5;

