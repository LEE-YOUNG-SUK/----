-- ============================================
-- 품목 카테고리 관리 RPC 함수
-- ============================================
-- 작성일: 2025-01-26
-- 목적: 카테고리 CRUD 기능

-- ============================================
-- 1. 카테고리 목록 조회
-- ============================================
CREATE OR REPLACE FUNCTION get_categories_list()
RETURNS TABLE (
  id TEXT,
  code TEXT,
  name TEXT,
  description TEXT,
  display_order INT,
  is_active BOOLEAN,
  product_count BIGINT,
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
    pc.id::TEXT,
    pc.code::TEXT,
    pc.name::TEXT,
    pc.description::TEXT,
    pc.display_order,
    pc.is_active,
    COUNT(p.id) AS product_count,
    pc.created_at,
    pc.updated_at
  FROM product_categories pc
  LEFT JOIN products p ON p.category_id = pc.id AND p.is_active = true
  GROUP BY pc.id, pc.code, pc.name, pc.description, pc.display_order, pc.is_active, pc.created_at, pc.updated_at
  ORDER BY pc.display_order, pc.name;
END;
$$;

-- ============================================
-- 2. 카테고리 생성
-- ============================================
CREATE OR REPLACE FUNCTION create_category(
  p_code TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_display_order INT DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  category_id TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- 코드 중복 체크
  IF EXISTS (SELECT 1 FROM product_categories WHERE code = p_code) THEN
    RETURN QUERY SELECT FALSE, '이미 존재하는 카테고리 코드입니다.'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 이름 중복 체크
  IF EXISTS (SELECT 1 FROM product_categories WHERE name = p_name) THEN
    RETURN QUERY SELECT FALSE, '이미 존재하는 카테고리명입니다.'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 카테고리 생성
  INSERT INTO product_categories (
    code,
    name,
    description,
    display_order,
    is_active
  ) VALUES (
    p_code,
    p_name,
    p_description,
    p_display_order,
    true
  )
  RETURNING id INTO v_category_id;

  RETURN QUERY SELECT TRUE, '카테고리가 생성되었습니다.'::TEXT, v_category_id::TEXT;
END;
$$;

-- ============================================
-- 3. 카테고리 수정
-- ============================================
CREATE OR REPLACE FUNCTION update_category(
  p_id UUID,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_display_order INT DEFAULT 0,
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
  -- 카테고리 존재 여부 확인
  IF NOT EXISTS (SELECT 1 FROM product_categories WHERE id = p_id) THEN
    RETURN QUERY SELECT FALSE, '존재하지 않는 카테고리입니다.'::TEXT;
    RETURN;
  END IF;

  -- 코드 중복 체크 (자기 자신 제외)
  IF EXISTS (SELECT 1 FROM product_categories WHERE code = p_code AND id != p_id) THEN
    RETURN QUERY SELECT FALSE, '이미 존재하는 카테고리 코드입니다.'::TEXT;
    RETURN;
  END IF;

  -- 이름 중복 체크 (자기 자신 제외)
  IF EXISTS (SELECT 1 FROM product_categories WHERE name = p_name AND id != p_id) THEN
    RETURN QUERY SELECT FALSE, '이미 존재하는 카테고리명입니다.'::TEXT;
    RETURN;
  END IF;

  -- 카테고리 수정
  UPDATE product_categories
  SET
    code = p_code,
    name = p_name,
    description = p_description,
    display_order = p_display_order,
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_id;

  RETURN QUERY SELECT TRUE, '카테고리가 수정되었습니다.'::TEXT;
END;
$$;

-- ============================================
-- 4. 카테고리 삭제
-- ============================================
CREATE OR REPLACE FUNCTION delete_category(
  p_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_count INT;
BEGIN
  -- 카테고리 존재 여부 확인
  IF NOT EXISTS (SELECT 1 FROM product_categories WHERE id = p_id) THEN
    RETURN QUERY SELECT FALSE, '존재하지 않는 카테고리입니다.'::TEXT;
    RETURN;
  END IF;

  -- 사용 중인 품목 확인
  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE category_id = p_id;

  IF v_product_count > 0 THEN
    RETURN QUERY SELECT FALSE, 
      format('이 카테고리를 사용하는 품목이 %s개 있어 삭제할 수 없습니다.', v_product_count)::TEXT;
    RETURN;
  END IF;

  -- 카테고리 삭제
  DELETE FROM product_categories WHERE id = p_id;

  RETURN QUERY SELECT TRUE, '카테고리가 삭제되었습니다.'::TEXT;
END;
$$;

-- ============================================
-- 5. 표시 순서 변경 (일괄)
-- ============================================
CREATE OR REPLACE FUNCTION update_categories_order(
  p_orders JSONB  -- [{"id": "uuid", "display_order": 1}, ...]
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- 각 항목의 순서 업데이트
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    UPDATE product_categories
    SET 
      display_order = (v_item->>'display_order')::INT,
      updated_at = NOW()
    WHERE id = (v_item->>'id')::UUID;
  END LOOP;

  RETURN QUERY SELECT TRUE, '표시 순서가 변경되었습니다.'::TEXT;
END;
$$;

-- ============================================
-- 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION get_categories_list() TO authenticated;
GRANT EXECUTE ON FUNCTION get_categories_list() TO anon;
GRANT EXECUTE ON FUNCTION create_category(TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_category(UUID, TEXT, TEXT, TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_categories_order(JSONB) TO authenticated;

-- ============================================
-- 확인
-- ============================================
SELECT '✅ 카테고리 관리 RPC 함수 생성 완료!' AS status;

-- 함수 목록 확인
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%categor%'
ORDER BY routine_name;

