-- ============================================
-- 판매/사용 거래유형 구분 추가
-- ============================================
-- 작성일: 2025-01-26
-- 목적: sales 테이블에 transaction_type 컬럼 추가
--       SALE (판매) vs USAGE (내부사용) 구분

-- ============================================
-- 1. 거래유형 컬럼 추가
-- ============================================
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS transaction_type TEXT 
DEFAULT 'SALE' 
CHECK (transaction_type IN ('SALE', 'USAGE'));

-- ============================================
-- 2. 기존 데이터 업데이트 (모두 판매로)
-- ============================================
UPDATE sales 
SET transaction_type = 'SALE' 
WHERE transaction_type IS NULL;

-- ============================================
-- 3. 인덱스 추가 (조회 성능 향상)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_transaction_type 
ON sales(transaction_type);

-- ============================================
-- 4. 내부사용 고객 추가 (없으면)
-- ============================================
INSERT INTO clients (id, code, name, type, is_active, created_at)
SELECT 
  gen_random_uuid(),
  'INTERNAL',
  '내부사용',
  'customer',
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE code = 'INTERNAL'
);

-- ============================================
-- 5. 컬럼 코멘트
-- ============================================
COMMENT ON COLUMN sales.transaction_type IS '거래유형: SALE(판매), USAGE(내부사용)';

-- ============================================
-- 6. 확인 쿼리
-- ============================================
SELECT 'transaction_type 컬럼 추가 완료' AS status;

SELECT 
  id,
  code,
  name,
  type,
  is_active
FROM clients 
WHERE code = 'INTERNAL';

-- ============================================
-- 7. 테이블 스키마 확인
-- ============================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name = 'transaction_type';

