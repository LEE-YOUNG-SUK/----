-- ============================================
-- 품목 관리 RPC 함수 생성
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_products_list();

-- 품목 목록 조회 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION get_products_list()
RETURNS TABLE (
    id UUID,
    code VARCHAR(50),
    name VARCHAR(100),
    category VARCHAR(50),
    unit VARCHAR(20),
    specification TEXT,
    manufacturer VARCHAR(100),
    barcode VARCHAR(100),
    min_stock_level INTEGER,
    standard_purchase_price NUMERIC(15,2),
    standard_sale_price NUMERIC(15,2),
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
        p.id,
        p.code,
        p.name,
        p.category,
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
    FROM public.products p
    ORDER BY p.code ASC;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_products_list() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_products_list() IS '모든 품목 목록 조회 (RLS 우회)';

-- ============================================
-- 테스트 쿼리
-- ============================================

-- 함수 실행 테스트
SELECT * FROM get_products_list();
