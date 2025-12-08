-- ============================================
-- 품목 목록 카테고리 조회 테스트
-- ============================================

-- 1. get_products_list() 함수로 조회 (카테고리 포함)
SELECT 
  code,
  name,
  category_id,
  category_code,
  category_name,
  unit
FROM get_products_list()
LIMIT 10;

-- 2. 직접 JOIN으로 확인
SELECT 
  p.code,
  p.name,
  p.category_id,
  pc.code AS category_code,
  pc.name AS category_name,
  p.unit
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
ORDER BY p.code
LIMIT 10;

-- 3. category_id가 NULL인 품목 확인
SELECT 
  code,
  name,
  category_id
FROM products
WHERE category_id IS NULL;

