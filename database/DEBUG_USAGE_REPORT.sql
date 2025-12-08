-- ============================================
-- 재료비 레포트 디버깅 쿼리
-- ============================================
-- 문제: 품목별 그룹핑 시 품목명 대신 UUID 표시
-- 작성일: 2025-01-26

-- ============================================
-- 1단계: USAGE 데이터 확인
-- ============================================
SELECT 
  '1. USAGE 데이터 확인' AS step,
  COUNT(*) AS usage_count,
  COUNT(DISTINCT product_id) AS product_count
FROM sales
WHERE transaction_type = 'USAGE';

-- ============================================
-- 2단계: USAGE 데이터 상세 확인 (최근 10건)
-- ============================================
SELECT 
  '2. USAGE 상세 데이터' AS step,
  s.id,
  s.sale_date,
  s.product_id,
  s.quantity,
  s.unit_price,
  s.total_price,
  s.transaction_type
FROM sales s
WHERE s.transaction_type = 'USAGE'
ORDER BY s.sale_date DESC
LIMIT 10;

-- ============================================
-- 3단계: products 테이블 확인
-- ============================================
SELECT 
  '3. products 테이블 확인' AS step,
  COUNT(*) AS total_products,
  COUNT(CASE WHEN is_active THEN 1 END) AS active_products
FROM products;

-- ============================================
-- 4단계: USAGE와 products 조인 확인 (핵심!)
-- ============================================
SELECT 
  '4. USAGE + products 조인' AS step,
  s.id AS sale_id,
  s.sale_date,
  s.product_id,
  p.id AS product_table_id,
  p.code AS product_code,
  p.name AS product_name,  -- ✅ 이 값이 NULL인지 확인!
  s.quantity,
  s.total_price
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
WHERE s.transaction_type = 'USAGE'
ORDER BY s.sale_date DESC
LIMIT 10;

-- ============================================
-- 5단계: 품목별 그룹핑 결과 확인 (레포트 로직 재현)
-- ============================================
SELECT 
  '5. 품목별 그룹핑 결과' AS step,
  s.product_id AS group_key,
  p.name AS group_label,  -- ✅ 이 값이 실제로 표시되어야 함
  COALESCE(p.name, '품목 없음') AS fallback_label,
  COUNT(s.id) AS transaction_count,
  SUM(s.quantity) AS total_quantity,
  SUM(s.total_price) AS total_revenue,
  AVG(s.unit_price) AS average_unit_price
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
WHERE s.transaction_type = 'USAGE'
  AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.product_id, p.name
ORDER BY total_revenue DESC;

-- ============================================
-- 6단계: 조인 실패 케이스 확인 (product_id가 있지만 products 테이블에 없는 경우)
-- ============================================
SELECT 
  '6. 조인 실패 케이스' AS step,
  s.product_id,
  COUNT(*) AS sales_count,
  'products 테이블에 없는 품목' AS issue
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
WHERE s.transaction_type = 'USAGE'
  AND p.id IS NULL  -- ✅ 조인 실패 (products에 없음)
GROUP BY s.product_id;

-- ============================================
-- 7단계: Supabase 클라이언트 조회 방식 재현
-- ============================================
-- 이것은 app/reports/usage/actions.ts의 실제 쿼리를 재현한 것입니다
SELECT 
  '7. Supabase 클라이언트 조회 재현' AS step,
  s.sale_date,
  s.product_id,
  s.quantity,
  s.unit_price,
  s.total_price,
  s.cost_of_goods_sold,
  s.profit,
  jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name  -- ✅ 이 값이 group_label이 됨
  ) AS products,
  jsonb_build_object(
    'id', b.id,
    'name', b.name
  ) AS branches
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
LEFT JOIN branches b ON s.branch_id = b.id
WHERE s.transaction_type = 'USAGE'
  AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY s.sale_date DESC
LIMIT 5;

-- ============================================
-- 8단계: 품목명이 NULL인 경우 확인
-- ============================================
SELECT 
  '8. 품목명 NULL 체크' AS step,
  s.product_id,
  p.id AS product_exists,
  p.name AS product_name,
  CASE 
    WHEN p.id IS NULL THEN 'products 테이블에 없음'
    WHEN p.name IS NULL THEN 'name 컬럼이 NULL'
    WHEN TRIM(p.name) = '' THEN 'name이 빈 문자열'
    ELSE 'OK'
  END AS status,
  COUNT(*) AS usage_count
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
WHERE s.transaction_type = 'USAGE'
GROUP BY s.product_id, p.id, p.name
HAVING p.name IS NULL OR TRIM(p.name) = '' OR p.id IS NULL
ORDER BY usage_count DESC;

-- ============================================
-- 9단계: 월별 그룹핑 확인 (비교용)
-- ============================================
SELECT 
  '9. 월별 그룹핑' AS step,
  TO_CHAR(s.sale_date, 'YYYY-MM') AS group_key,
  TO_CHAR(s.sale_date, 'YYYY-MM') AS group_label,
  COUNT(s.id) AS transaction_count,
  SUM(s.quantity) AS total_quantity,
  SUM(s.total_price) AS total_revenue
FROM sales s
WHERE s.transaction_type = 'USAGE'
  AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
ORDER BY group_key DESC;

-- ============================================
-- 결과 해석 가이드
-- ============================================
/*
✅ 정상인 경우:
- 4단계에서 product_name이 모두 채워져 있음
- 5단계에서 group_label이 품목명으로 표시됨
- 6단계에서 결과가 0건

❌ 문제가 있는 경우:
- 4단계에서 product_name이 NULL
  → product_id가 products 테이블에 없음
  → sales 데이터 입력 시 잘못된 product_id 사용

- 5단계에서 group_label이 NULL
  → products 테이블의 name 컬럼이 NULL
  → products 데이터 수정 필요

- 6단계에서 결과가 있음
  → 조인 실패 케이스 존재
  → 해당 product_id를 products 테이블에서 찾을 수 없음
*/

