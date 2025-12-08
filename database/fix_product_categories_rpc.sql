-- ============================================
-- get_product_categories 함수 타입 불일치 수정
-- ============================================
-- 작성일: 2025-01-26
-- 에러: VARCHAR(20) vs TEXT 타입 불일치

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_product_categories() CASCADE;

-- 타입 캐스팅을 추가한 함수 재생성
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
    pc.code::TEXT,        -- VARCHAR(20) → TEXT 명시적 캐스팅
    pc.name::TEXT,        -- VARCHAR(100) → TEXT 명시적 캐스팅
    pc.description::TEXT, -- TEXT (이미 TEXT지만 명시)
    pc.display_order,
    pc.is_active
  FROM product_categories pc
  WHERE pc.is_active = true
  ORDER BY pc.display_order;
END;
$$;

GRANT EXECUTE ON FUNCTION get_product_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_categories() TO anon;

-- 확인
SELECT '✅ get_product_categories 함수 수정 완료!' AS status;

-- 테스트
SELECT * FROM get_product_categories();

