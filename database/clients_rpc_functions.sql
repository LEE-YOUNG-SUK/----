-- ============================================
-- 거래처 관리 RPC 함수 생성
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_clients_list();

-- 거래처 목록 조회 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION get_clients_list()
RETURNS TABLE (
    id UUID,
    code VARCHAR(50),
    name VARCHAR(100),
    type VARCHAR(20),
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(50),
    notes TEXT,
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
        c.id,
        c.code,
        c.name,
        c.type,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.tax_id,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at
    FROM public.clients c
    ORDER BY c.code ASC;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_clients_list() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_clients_list() IS '모든 거래처 목록 조회 (RLS 우회)';

-- 공급업체 목록 조회 함수 (RLS 우회)
DROP FUNCTION IF EXISTS get_suppliers_list();

CREATE OR REPLACE FUNCTION get_suppliers_list()
RETURNS TABLE (
    id UUID,
    code VARCHAR(50),
    name VARCHAR(100),
    type VARCHAR(20),
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(50),
    notes TEXT,
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
        c.id,
        c.code,
        c.name,
        c.type,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.tax_id,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at
    FROM public.clients c
    WHERE c.type IN ('supplier', 'both')
      AND c.is_active = true
    ORDER BY c.name ASC;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_suppliers_list() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_suppliers_list() IS '공급업체 목록 조회 (RLS 우회)';

-- 고객 목록 조회 함수 (RLS 우회)
DROP FUNCTION IF EXISTS get_customers_list();

CREATE OR REPLACE FUNCTION get_customers_list()
RETURNS TABLE (
    id UUID,
    code VARCHAR(50),
    name VARCHAR(100),
    type VARCHAR(20),
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(50),
    notes TEXT,
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
        c.id,
        c.code,
        c.name,
        c.type,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.tax_id,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at
    FROM public.clients c
    WHERE c.type IN ('customer', 'both')
      AND c.is_active = true
    ORDER BY c.name ASC;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_customers_list() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_customers_list() IS '고객 목록 조회 (RLS 우회)';

-- ============================================
-- 테스트 쿼리
-- ============================================

-- 함수 실행 테스트
SELECT * FROM get_clients_list();
SELECT * FROM get_suppliers_list();
SELECT * FROM get_customers_list();
