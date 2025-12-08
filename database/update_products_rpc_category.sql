-- ============================================
-- products RPC 함수 카테고리 업데이트
-- ============================================
-- 작성일: 2025-01-26
-- 목적: category(TEXT) → category_id(UUID) 변경 반영

-- 1. get_products_list 함수 재생성
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
    p.code,
    p.name,
    p.category_id::TEXT,
    pc.code AS category_code,
    pc.name AS category_name,
    p.unit,
    p.specification,
    p.manufacturer,
    p.barcode,
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

-- 2. create_product 함수 재생성 (category → category_id)
DROP FUNCTION IF EXISTS create_product(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION create_product(
  p_code TEXT,
  p_name TEXT,
  p_category_id UUID,  -- ✅ TEXT → UUID
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
    category_id,  -- ✅
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
    p_category_id,  -- ✅
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

GRANT EXECUTE ON FUNCTION create_product(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC) TO authenticated;

-- 3. update_product 함수 재생성 (category → category_id)
DROP FUNCTION IF EXISTS update_product(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC, BOOLEAN) CASCADE;

CREATE OR REPLACE FUNCTION update_product(
  p_id UUID,
  p_name TEXT,
  p_category_id UUID,  -- ✅ TEXT → UUID
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
    category_id = p_category_id,  -- ✅
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

GRANT EXECUTE ON FUNCTION update_product(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- 4. 카테고리 목록 조회 함수 추가
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
    pc.code::TEXT,        -- ✅ 명시적 캐스팅 추가
    pc.name::TEXT,        -- ✅ 명시적 캐스팅 추가
    pc.description::TEXT, -- ✅ 명시적 캐스팅 추가 (이미 TEXT지만 명시)
    pc.display_order,
    pc.is_active
  FROM product_categories pc
  WHERE pc.is_active = true
  ORDER BY pc.display_order;
END;
$$;

GRANT EXECUTE ON FUNCTION get_product_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_categories() TO anon;

-- 5. 확인
SELECT '✅ products RPC 함수 업데이트 완료!' AS status;

-- 카테고리 목록 조회 테스트
SELECT * FROM get_product_categories();

-- 품목 목록 조회 테스트
SELECT 
  code,
  name,
  category_code,
  category_name
FROM get_products_list()
LIMIT 10;

