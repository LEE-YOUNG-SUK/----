-- ============================================
-- products 테이블 카테고리 마이그레이션
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 자유 입력 category(TEXT)를 정규화된 category_id(UUID)로 변경

-- ⚠️ 주의: 이 스크립트를 실행하기 전에 반드시 백업하세요!
-- CREATE TABLE products_backup_20250126 AS SELECT * FROM products;

-- 1. category_id 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID 
  REFERENCES product_categories(id);

-- 2. 기존 category(TEXT) 값을 category_id(UUID)로 매핑
-- 완전히 일치하는 카테고리만 자동 매핑
UPDATE products p
SET category_id = (
  SELECT pc.id 
  FROM product_categories pc 
  WHERE pc.name = p.category
  LIMIT 1
)
WHERE p.category IS NOT NULL 
  AND p.category != ''
  AND EXISTS (
    SELECT 1 FROM product_categories pc WHERE pc.name = p.category
  );

-- 3. 매핑되지 않은 품목 확인 (NULL인 것들)
SELECT 
  id,
  code,
  name,
  category AS old_category,
  category_id
FROM products
WHERE category IS NOT NULL 
  AND category != ''
  AND category_id IS NULL;

-- 4. 매핑되지 않은 품목에 기본 카테고리 설정 (옵션)
-- 기본값: '기타소모품품' (00013)
UPDATE products
SET category_id = (SELECT id FROM product_categories WHERE code = '00013')
WHERE category_id IS NULL;

-- 5. 기존 category 컬럼 백업용 이름 변경 (삭제하지 않고 보관)
ALTER TABLE products RENAME COLUMN category TO category_old;

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- 7. 코멘트 추가
COMMENT ON COLUMN products.category_id IS '카테고리 ID (product_categories 테이블 참조)';
COMMENT ON COLUMN products.category_old IS '구 카테고리 (TEXT, 백업용)';

-- 8. 결과 확인
SELECT '✅ products 테이블 마이그레이션 완료!' AS status;

-- 매핑 결과 확인
SELECT 
  p.code,
  p.name,
  p.category_old,
  pc.code AS category_code,
  pc.name AS category_name,
  p.category_id
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
ORDER BY p.code
LIMIT 20;

-- 카테고리별 품목 수
SELECT 
  pc.code,
  pc.name,
  COUNT(p.id) AS product_count
FROM product_categories pc
LEFT JOIN products p ON p.category_id = pc.id
GROUP BY pc.id, pc.code, pc.name
ORDER BY pc.display_order;

-- ============================================
-- 롤백 방법 (문제 발생 시)
-- ============================================
/*
-- category_id 삭제
ALTER TABLE products DROP COLUMN IF EXISTS category_id;

-- category_old를 category로 복원
ALTER TABLE products RENAME COLUMN category_old TO category;

-- 또는 백업에서 복구
-- DROP TABLE products;
-- CREATE TABLE products AS SELECT * FROM products_backup_20250126;
*/

