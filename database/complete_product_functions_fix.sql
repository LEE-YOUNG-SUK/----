-- ============================================
-- 품목 RPC 함수 완전 수정 (타입 캐스팅 포함)
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 모든 타입 불일치 문제 해결

-- ============================================
-- STEP 1: 기존 함수 모두 삭제
-- ============================================
DROP FUNCTION IF EXISTS create_product(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS update_product(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_products_list() CASCADE;
DROP FUNCTION IF EXISTS get_product_categories() CASCADE;

-- ============================================
-- STEP 2: get_product_categories 생성
-- ============================================
CREATE OR REPLACE FUNCTION get_product_categories()
RETURNS TABLE (
  id TEXT,
  code TEXT,
  name TEXT,
  description TEXT,
  display_order INT,
  is_active BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id::TEXT,
    pc.code::TEXT,
    pc.name::TEXT,
    pc.description::TEXT,
    pc.display_order,
    pc.is_active
  FROM product_categories pc
  WHERE pc.is_active = true
  ORDER BY pc.display_order;
END;
$$;

-- ============================================
-- STEP 3: get_products_list 생성 (모든 컬럼 캐스팅)
-- ============================================
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
    p.code::TEXT,
    p.name::TEXT,
    p.category_id::TEXT,
    COALESCE(pc.code::TEXT, '') AS category_code,
    COALESCE(pc.name::TEXT, '') AS category_name,
    p.unit::TEXT,
    p.specification::TEXT,
    p.manufacturer::TEXT,
    p.barcode::TEXT,
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

-- ============================================
-- STEP 4: create_product 생성
-- ============================================
CREATE OR REPLACE FUNCTION create_product(
  p_code TEXT,
  p_name TEXT,
  p_category_id UUID,
  p_unit TEXT,
  p_specification TEXT DEFAULT NULL,
  p_manufacturer TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_min_stock_level INT DEFAULT NULL,
  p_standard_purchase_price NUMERIC DEFAULT NULL,
  p_standard_sale_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  product_id TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- 코드 중복 체크
  IF EXISTS (SELECT 1 FROM products WHERE code = p_code) THEN
    RETURN QUERY SELECT FALSE, '이미 존재하는 품목 코드입니다.'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 품목 생성
  INSERT INTO products (
    code,
    name,
    category_id,
    unit,
    specification,
    manufacturer,
    barcode,
    min_stock_level,
    standard_purchase_price,
    standard_sale_price,
    is_active
  ) VALUES (
    p_code,
    p_name,
    p_category_id,
    p_unit,
    p_specification,
    p_manufacturer,
    p_barcode,
    p_min_stock_level,
    p_standard_purchase_price,
    p_standard_sale_price,
    true
  )
  RETURNING id INTO v_product_id;

  RETURN QUERY SELECT TRUE, '품목이 생성되었습니다.'::TEXT, v_product_id::TEXT;
END;
$$;

-- ============================================
-- STEP 5: update_product 생성
-- ============================================
CREATE OR REPLACE FUNCTION update_product(
  p_id UUID,
  p_name TEXT,
  p_category_id UUID,
  p_unit TEXT,
  p_specification TEXT DEFAULT NULL,
  p_manufacturer TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_min_stock_level INT DEFAULT NULL,
  p_standard_purchase_price NUMERIC DEFAULT NULL,
  p_standard_sale_price NUMERIC DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- 품목 존재 여부 확인
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_id) THEN
    RETURN QUERY SELECT FALSE, '존재하지 않는 품목입니다.'::TEXT;
    RETURN;
  END IF;

  -- 품목 수정
  UPDATE products
  SET
    name = p_name,
    category_id = p_category_id,
    unit = p_unit,
    specification = p_specification,
    manufacturer = p_manufacturer,
    barcode = p_barcode,
    min_stock_level = p_min_stock_level,
    standard_purchase_price = p_standard_purchase_price,
    standard_sale_price = p_standard_sale_price,
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_id;

  RETURN QUERY SELECT TRUE, '품목이 수정되었습니다.'::TEXT;
END;
$$;

-- ============================================
-- STEP 6: 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION get_product_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_categories() TO anon;
GRANT EXECUTE ON FUNCTION get_products_list() TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_list() TO anon;
GRANT EXECUTE ON FUNCTION create_product(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_product(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- STEP 7: 확인 및 테스트
-- ============================================
SELECT '✅ 모든 품목 RPC 함수 생성 완료!' AS status;

-- 생성된 함수 확인
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_product_categories', 'create_product', 'update_product', 'get_products_list')
ORDER BY routine_name;

-- 카테고리 목록 테스트
SELECT '=== 카테고리 목록 ===' AS test;
SELECT id, code, name FROM get_product_categories() LIMIT 5;

-- 품목 목록 테스트
SELECT '=== 품목 목록 ===' AS test;
SELECT code, name, category_name, unit FROM get_products_list() LIMIT 5;

