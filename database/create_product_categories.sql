-- ============================================
-- 품목 카테고리 테이블 생성 및 초기 데이터
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 품목 카테고리를 정규화하여 드롭다운 선택 및 필터링 지원

-- 1. 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. updated_at 자동 업데이트 트리거
CREATE OR REPLACE TRIGGER product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. 초기 카테고리 데이터 (실제 사용 중인 카테고리)
INSERT INTO product_categories (code, name, display_order) VALUES
  ('00001', '필러', 1),
  ('00002', '보톡스', 2),
  ('00003', '기타쁘띠', 3),
  ('00004', '리프팅실', 4),
  ('00005', '화장품', 5),
  ('00006', '약/주사', 6),
  ('00007', '약/외용', 7),
  ('00008', '약/기타', 8),
  ('00009', '장비소모품', 9),
  ('00010', '외용소모품', 10),
  ('00011', '스킨소모품', 11),
  ('00012', '사무소모품', 12),
  ('00013', '기타소모품품', 13)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order;

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_categories_code ON product_categories(code);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_product_categories_display_order ON product_categories(display_order);

-- 5. 코멘트 추가
COMMENT ON TABLE product_categories IS '품목 카테고리 마스터 테이블';
COMMENT ON COLUMN product_categories.code IS '카테고리 코드 (예: 00001, 00002)';
COMMENT ON COLUMN product_categories.name IS '카테고리명 (예: 필러, 보톡스)';
COMMENT ON COLUMN product_categories.display_order IS '표시 순서 (정렬용)';

-- 6. 확인
SELECT '✅ product_categories 테이블 생성 완료!' AS status;

SELECT 
  code,
  name,
  display_order,
  is_active
FROM product_categories
ORDER BY display_order;

-- 예상 결과:
-- code  | name        | display_order | is_active
-- ------|-------------|---------------|----------
-- 00001 | 필러         |       1       |    t
-- 00002 | 보톡스       |       2       |    t
-- 00003 | 기타뷰티     |       3       |    t
-- 00004 | 리프팅샵     |       4       |    t
-- 00005 | 화장품       |       5       |    t
-- 00006 | 악/주사      |       6       |    t
-- 00007 | 악/외용      |       7       |    t
-- 00008 | 악/기타      |       8       |    t
-- 00009 | 장비스킨룸   |       9       |    t
-- 00010 | 외용스킨룸   |      10       |    t
-- 00011 | 스킨스킨룸   |      11       |    t
-- 00012 | 샤푸스킨룸   |      12       |    t
-- 00013 | 기타스킨룸   |      13       |    t

