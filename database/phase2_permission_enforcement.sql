-- =====================================================
-- Phase 2: 권한 시스템 강화 - RPC 함수 지점 격리
-- =====================================================
-- 목적: 모든 조회 RPC 함수에 지점 격리 검증 추가
-- 보안: 시스템 관리자 외에는 본인 지점 데이터만 조회 가능

-- =====================================================
-- 1. 입고 내역 조회 함수 (지점 격리 추가)
-- =====================================================
DROP FUNCTION IF EXISTS get_purchases_list(TEXT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_purchases_list(TEXT, DATE, DATE, UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_purchases_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_id UUID DEFAULT NULL  -- 추가: 권한 검증용
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
SET search_path = public
AS $$
DECLARE
  v_user_branch_id UUID;
  v_user_role TEXT;
BEGIN
  -- ============================================
  -- 권한 검증: 본인 지점만 조회 가능 (시스템 관리자 제외)
  -- ============================================
  IF p_user_id IS NOT NULL THEN
    SELECT u.branch_id, u.role INTO v_user_branch_id, v_user_role
    FROM users u
    WHERE u.id = p_user_id;
    
    -- 시스템 관리자가 아니면 본인 지점으로 필터링 강제
    IF v_user_role != '0000' THEN
      -- p_branch_id가 NULL이거나 본인 지점이 아니면 본인 지점으로 강제 변경
      IF p_branch_id IS NULL OR p_branch_id::UUID != v_user_branch_id THEN
        p_branch_id := v_user_branch_id::TEXT;
      END IF;
    END IF;
  END IF;

  -- ============================================
  -- 데이터 조회
  -- ============================================
  RETURN QUERY
  SELECT 
    p.id::TEXT,
    p.branch_id::TEXT,
    b.name::TEXT AS branch_name,
    p.client_id::TEXT,
    c.name::TEXT AS client_name,
    p.product_id::TEXT,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.unit::TEXT,
    p.purchase_date,
    p.quantity::NUMERIC,
    p.unit_cost,
    p.total_cost,
    p.reference_number::TEXT,
    p.notes::TEXT,
    p.created_at,
    p.created_by::TEXT
  FROM purchases p
  INNER JOIN branches b ON p.branch_id = b.id
  INNER JOIN clients c ON p.client_id = c.id
  INNER JOIN products pr ON p.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR p.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_purchases_list(TEXT, DATE, DATE, UUID) IS '입고 내역 조회 (지점 격리 적용)';

-- =====================================================
-- 2. 판매 내역 조회 함수 (지점 격리 추가)
-- =====================================================
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE, UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_id UUID DEFAULT NULL  -- 추가: 권한 검증용
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
  created_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_branch_id UUID;
  v_user_role TEXT;
BEGIN
  -- ============================================
  -- 권한 검증: 본인 지점만 조회 가능
  -- ============================================
  IF p_user_id IS NOT NULL THEN
    SELECT u.branch_id, u.role INTO v_user_branch_id, v_user_role
    FROM users u
    WHERE u.id = p_user_id;
    
    IF v_user_role != '0000' THEN
      IF p_branch_id IS NULL OR p_branch_id::UUID != v_user_branch_id THEN
        p_branch_id := v_user_branch_id::TEXT;
      END IF;
    END IF;
  END IF;

  -- ============================================
  -- 데이터 조회
  -- ============================================
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
    s.total_price AS total_amount,
    s.cost_of_goods_sold AS cost_of_goods,
    s.profit,
    CASE 
      WHEN s.total_price > 0 THEN (s.profit / s.total_price * 100)
      ELSE 0 
    END AS profit_margin,
    s.reference_number::TEXT,
    s.notes::TEXT,
    s.created_at,
    s.created_by::TEXT
  FROM sales s
  INNER JOIN branches b ON s.branch_id = b.id
  INNER JOIN clients c ON s.client_id = c.id
  INNER JOIN products pr ON s.product_id = pr.id
  WHERE 
    (p_branch_id IS NULL OR s.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_sales_list(TEXT, DATE, DATE, UUID) IS '판매 내역 조회 (지점 격리 적용)';

-- =====================================================
-- 3. 재고 조회 함수 (지점 격리 추가)
-- =====================================================
DROP FUNCTION IF EXISTS get_inventory_by_branch(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_inventory_by_branch(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_inventory_by_branch(
  p_branch_id UUID,
  p_user_id UUID DEFAULT NULL  -- 추가: 권한 검증용
)
RETURNS TABLE (
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  category TEXT,
  unit TEXT,
  total_quantity NUMERIC,
  average_cost NUMERIC,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_branch_id UUID;
  v_user_role TEXT;
BEGIN
  -- ============================================
  -- 권한 검증: 본인 지점만 조회 가능
  -- ============================================
  IF p_user_id IS NOT NULL THEN
    SELECT u.branch_id, u.role INTO v_user_branch_id, v_user_role
    FROM users u
    WHERE u.id = p_user_id;
    
    -- 시스템 관리자가 아니면 본인 지점만 허용
    IF v_user_role != '0000' AND v_user_branch_id != p_branch_id THEN
      RAISE EXCEPTION '권한 없음: 본인 지점(%)의 재고만 조회 가능합니다.', v_user_branch_id;
    END IF;
  END IF;

  -- ============================================
  -- 재고 데이터 조회
  -- ============================================
  RETURN QUERY
  SELECT 
    il.product_id,
    pr.code::TEXT AS product_code,
    pr.name::TEXT AS product_name,
    pr.category::TEXT,
    pr.unit::TEXT,
    SUM(il.remaining_quantity) AS total_quantity,
    CASE 
      WHEN SUM(il.remaining_quantity) > 0 
      THEN SUM(il.remaining_quantity * il.unit_cost) / SUM(il.remaining_quantity)
      ELSE 0
    END AS average_cost,
    SUM(il.remaining_quantity * il.unit_cost) AS total_value
  FROM inventory_layers il
  INNER JOIN products pr ON il.product_id = pr.id
  WHERE il.branch_id = p_branch_id
    AND il.remaining_quantity > 0
  GROUP BY il.product_id, pr.code, pr.name, pr.category, pr.unit
  ORDER BY pr.code;
END;
$$;

COMMENT ON FUNCTION get_inventory_by_branch(UUID, UUID) IS '지점별 재고 조회 (지점 격리 적용)';

-- =====================================================
-- 4. 권한 부여
-- =====================================================
GRANT EXECUTE ON FUNCTION get_purchases_list(TEXT, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_by_branch(UUID, UUID) TO authenticated;

-- =====================================================
-- 5. 오버로딩 제거 (PGRST203 에러 방지)
-- =====================================================
-- Supabase RPC는 같은 파라미터 타입 함수 오버로딩 지원 안함
-- Server Actions에서 항상 p_user_id 명시적 전달 필요
