-- ============================================
-- get_current_inventory 함수 수정
-- ============================================
-- 작성일: 2025-12-09
-- 목적: 재고 페이지 카테고리 조회 오류 수정
-- 문제: p.category 컬럼 직접 참조 (존재하지 않는 컬럼)
-- 해결: product_categories 테이블 JOIN 추가
-- ============================================

DROP FUNCTION IF EXISTS get_current_inventory(UUID);

CREATE OR REPLACE FUNCTION get_current_inventory(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  branch_id UUID,
  branch_name VARCHAR,
  product_id UUID,
  product_code VARCHAR,
  product_name VARCHAR,
  unit VARCHAR,
  category VARCHAR,
  current_quantity BIGINT,
  layer_count BIGINT,
  oldest_purchase_date DATE,
  newest_purchase_date DATE,
  avg_unit_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.branch_id,
    b.name::VARCHAR AS branch_name,
    il.product_id,
    p.code::VARCHAR AS product_code,
    p.name::VARCHAR AS product_name,
    p.unit::VARCHAR,
    COALESCE(pc.name, '미분류')::VARCHAR AS category,  -- ✅ 수정: product_categories JOIN
    SUM(il.remaining_quantity)::BIGINT AS current_quantity,
    COUNT(DISTINCT il.id)::BIGINT AS layer_count,
    MIN(il.purchase_date)::DATE AS oldest_purchase_date,
    MAX(il.purchase_date)::DATE AS newest_purchase_date,
    AVG(il.unit_cost)::NUMERIC AS avg_unit_cost
  FROM inventory_layers il
  JOIN branches b ON b.id = il.branch_id
  JOIN products p ON p.id = il.product_id
  LEFT JOIN product_categories pc ON p.category_id = pc.id  -- ✅ 추가: 카테고리 테이블 JOIN
  WHERE (p_branch_id IS NULL OR il.branch_id = p_branch_id)
    AND il.remaining_quantity > 0
  GROUP BY il.branch_id, b.name, il.product_id, p.code, p.name, p.unit, pc.name
  ORDER BY p.code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_inventory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_inventory(UUID) TO anon;

-- ============================================
-- 확인
-- ============================================
SELECT '✅ get_current_inventory 함수 수정 완료!' AS status;

-- 함수 확인
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_current_inventory';

-- ============================================
-- 변경 사항 요약
-- ============================================
/*
변경 전:
  p.category AS category  -- ❌ products 테이블에 category 컬럼 없음

변경 후:
  LEFT JOIN product_categories pc ON p.category_id = pc.id  -- ✅ 카테고리 테이블 조인
  COALESCE(pc.name, '미분류')::VARCHAR AS category           -- ✅ 카테고리명 조회

영향:
  - 재고 페이지에서 카테고리 컬럼이 정상적으로 표시됨
  - 카테고리가 없는 품목은 '미분류'로 표시됨
*/
