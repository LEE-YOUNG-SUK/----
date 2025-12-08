-- ============================================
-- get_products_list 함수 타입 캐스팅 수정
-- ============================================
-- 작성일: 2025-01-26
-- 에러: products 테이블 컬럼 타입 불일치

-- 1. 현재 products 테이블 구조 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- 2. get_products_list 함수 삭제 후 재생성 (모든 컬럼 명시적 캐스팅)
DROP FUNCTION IF EXISTS get_products_list() CASCADE;

CREATE OR REPLACE FUNCTION get_products_list()
RETURNS TABLE (
  id TEXT,
  code TEXT,
  name TEXT,
  category_id TEXT,
  category_code TEXT,
  category_name TEXT,
  unit TEXT,
  specification TEXT,
  manufacturer TEXT,
  barcode TEXT,
  min_stock_level INT,
  standard_purchase_price NUMERIC,
  standard_sale_price NUMERIC,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::TEXT,
    p.code::TEXT,                             -- ✅ 명시적 캐스팅
    p.name::TEXT,                             -- ✅ 명시적 캐스팅
    p.category_id::TEXT,
    COALESCE(pc.code::TEXT, '')::TEXT AS category_code,       -- ✅ 명시적 캐스팅
    COALESCE(pc.name::TEXT, '')::TEXT AS category_name,       -- ✅ 명시적 캐스팅
    p.unit::TEXT,                             -- ✅ 명시적 캐스팅
    COALESCE(p.specification::TEXT, NULL) AS specification,   -- ✅ 명시적 캐스팅
    COALESCE(p.manufacturer::TEXT, NULL) AS manufacturer,     -- ✅ 명시적 캐스팅
    COALESCE(p.barcode::TEXT, NULL) AS barcode,               -- ✅ 명시적 캐스팅
    p.min_stock_level,
    p.standard_purchase_price,
    p.standard_sale_price,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  ORDER BY p.code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_products_list() TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_list() TO anon;

-- 3. 확인
SELECT '✅ get_products_list 함수 타입 캐스팅 수정 완료!' AS status;

-- 4. 테스트
SELECT 
  code,
  name,
  category_name,
  unit
FROM get_products_list()
LIMIT 5;

