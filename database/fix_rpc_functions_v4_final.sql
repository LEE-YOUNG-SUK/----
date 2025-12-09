-- ============================================
-- 입고/판매 내역 조회 RPC 함수 (최종 v4)
-- ============================================
-- 작성일: 2025-12-09
-- 실제 DB 컬럼 타입에 맞춰 정확하게 작성

-- ============================================
-- 1. 모든 버전의 함수 완전 삭제
-- ============================================
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc 
    WHERE proname = 'get_purchases_list'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    RAISE NOTICE 'Dropped: %', func_record.func_signature;
  END LOOP;
  
  FOR func_record IN 
    SELECT oid::regprocedure AS func_signature
    FROM pg_proc 
    WHERE proname = 'get_sales_list'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    RAISE NOTICE 'Dropped: %', func_record.func_signature;
  END LOOP;
END $$;

-- ============================================
-- 2. 입고 내역 조회 함수
-- ============================================
-- purchases 테이블 컬럼:
--   id: uuid, branch_id: uuid, product_id: uuid, client_id: uuid (nullable)
--   quantity: integer, unit_cost: numeric, total_cost: numeric
--   supply_price: numeric, tax_amount: numeric, total_price: numeric
--   purchase_date: date, reference_number: varchar, notes: text
--   created_at: timestamptz, created_by: uuid

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
  quantity INTEGER,
  unit_cost NUMERIC,
  supply_price NUMERIC,
  tax_amount NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  created_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.branch_id,
    b.name::TEXT AS branch_name,
    p.client_id,
    COALESCE(c.name::TEXT, '') AS client_name,
    p.product_id,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT AS unit,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    p.supply_price,
    p.tax_amount,
    COALESCE(p.total_cost, p.total_price) AS total_cost,
    COALESCE(p.reference_number::TEXT, '') AS reference_number,
    COALESCE(p.notes, '') AS notes,
    p.created_at,
    p.created_by,
    COALESCE(u.display_name::TEXT, u.username::TEXT, '알 수 없음') AS created_by_name
  FROM purchases p
  INNER JOIN branches b ON p.branch_id = b.id
  LEFT JOIN clients c ON p.client_id = c.id
  INNER JOIN products pr ON p.product_id = pr.id
  LEFT JOIN users u ON p.created_by = u.id
  WHERE 
    (p_branch_id IS NULL OR p.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_purchases_list(TEXT, DATE, DATE) IS '입고 내역 조회 - 담당자 이름 포함';

-- ============================================
-- 3. 판매 내역 조회 함수
-- ============================================
-- sales 테이블 컬럼:
--   id: uuid, branch_id: uuid, product_id: uuid, client_id: uuid (nullable)
--   quantity: integer, unit_price: numeric
--   supply_price: numeric, tax_amount: numeric, total_price: numeric
--   cost_of_goods_sold: numeric, profit: numeric
--   sale_date: date, reference_number: varchar, notes: text
--   transaction_type: text, created_at: timestamptz, created_by: uuid

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
  quantity INTEGER,
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
  created_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.branch_id,
    b.name::TEXT AS branch_name,
    s.client_id,
    COALESCE(c.name::TEXT, '') AS customer_name,
    s.product_id,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT AS unit,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.supply_price,
    s.tax_amount,
    s.total_price,
    COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods_sold,
    COALESCE(s.profit, 0) AS profit,
    COALESCE(s.reference_number::TEXT, '') AS reference_number,
    COALESCE(s.notes, '') AS notes,
    COALESCE(s.transaction_type, 'SALE') AS transaction_type,
    s.created_at,
    s.created_by,
    COALESCE(u.display_name::TEXT, u.username::TEXT, '알 수 없음') AS created_by_name
  FROM sales s
  INNER JOIN branches b ON s.branch_id = b.id
  LEFT JOIN clients c ON s.client_id = c.id
  INNER JOIN products pr ON s.product_id = pr.id
  LEFT JOIN users u ON s.created_by = u.id
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
GRANT EXECUTE ON FUNCTION get_purchases_list(TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE) TO anon;

-- ============================================
-- 5. 검증
-- ============================================
SELECT '✅ RPC 함수 생성 완료!' AS status;

-- 함수 확인
SELECT 
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc 
WHERE proname IN ('get_purchases_list', 'get_sales_list')
  AND pronamespace = 'public'::regnamespace;

-- 테스트: 입고 내역 (명시적 타입)
SELECT 
  id,
  reference_number, 
  product_name, 
  client_name,
  quantity,
  unit_cost,
  total_cost,
  created_by_name
FROM get_purchases_list(NULL::TEXT, NULL::DATE, NULL::DATE) 
LIMIT 5;

-- 테스트: 판매 내역 (명시적 타입)
SELECT 
  id,
  reference_number, 
  product_name, 
  customer_name,
  quantity,
  unit_price,
  total_price,
  transaction_type,
  created_by_name
FROM get_sales_list(NULL::TEXT, NULL::DATE, NULL::DATE) 
LIMIT 5;
