-- ============================================
-- get_sales_list 함수 정리 및 수정
-- ============================================
-- 작성일: 2025-01-26
-- 목적: UUID 버전 함수 제거 및 TEXT 버전에 transaction_type 필터 추가
-- 문제: UUID 버전은 out_id, out_sale_date 등을 반환하여 클라이언트와 불일치

-- 1. 문제가 되는 UUID 버전 삭제
DROP FUNCTION IF EXISTS get_sales_list(UUID, DATE, DATE, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_sales_list(UUID, DATE, DATE, UUID) CASCADE;

-- 2. 기존 TEXT 버전 삭제 후 재생성 (transaction_type 파라미터 추가)
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE, TEXT) CASCADE;

-- 3. 새 함수 생성 (TEXT 버전 + transaction_type)
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  client_id TEXT,
  customer_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  sale_date DATE,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_amount NUMERIC,
  cost_of_goods NUMERIC,
  profit NUMERIC,
  profit_margin NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT,
  transaction_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_branch_id UUID;
  v_user_role TEXT;
BEGIN
  -- 권한 검증
  IF p_user_id IS NOT NULL AND p_user_id != '' THEN
    SELECT u.branch_id, u.role INTO v_user_branch_id, v_user_role
    FROM users u
    WHERE u.id::TEXT = p_user_id;
    
    -- 시스템 관리자가 아니면 본인 지점만
    IF v_user_role != '0000' AND v_user_branch_id IS NOT NULL THEN
      IF p_branch_id IS NULL OR p_branch_id = '' THEN
        p_branch_id := v_user_branch_id::TEXT;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    s.id::TEXT,
    s.branch_id::TEXT,
    b.name::TEXT AS branch_name,
    s.client_id::TEXT,
    c.name::TEXT AS customer_name,
    s.product_id::TEXT,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT,
    s.sale_date,
    s.quantity::NUMERIC,
    s.unit_price,
    COALESCE(s.total_price, s.quantity * s.unit_price) AS total_amount,
    COALESCE(s.cost_of_goods_sold, 0::NUMERIC) AS cost_of_goods,
    COALESCE(s.profit, 0::NUMERIC) AS profit,
    CASE 
      WHEN s.total_price > 0 THEN (COALESCE(s.profit, 0) / s.total_price * 100)
      ELSE 0 
    END AS profit_margin,
    s.reference_number::TEXT,
    s.notes::TEXT,
    s.created_at,
    s.created_by::TEXT,
    COALESCE(s.transaction_type, 'SALE')::TEXT AS transaction_type
  FROM sales s
  LEFT JOIN branches b ON s.branch_id = b.id
  LEFT JOIN clients c ON s.client_id = c.id
  LEFT JOIN products pr ON s.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR p_branch_id = '' OR s.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    AND (p_transaction_type IS NULL OR p_transaction_type = '' OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;

-- 4. 권한 부여
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION get_sales_list(TEXT, DATE, DATE, TEXT, TEXT) IS '판매/사용 내역 조회 (지점 격리 + transaction_type 필터)';

-- 5. 확인
SELECT '✅ get_sales_list 함수 정리 완료!' AS status;

-- 6. 함수 목록 재확인
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_sales_list';

-- 7. 테스트
SELECT COUNT(*) AS sale_count FROM get_sales_list(NULL, NULL, NULL, NULL, 'SALE');
SELECT COUNT(*) AS usage_count FROM get_sales_list(NULL, NULL, NULL, NULL, 'USAGE');

