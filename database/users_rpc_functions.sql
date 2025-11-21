-- ============================================
-- 사용자 관리 RPC 함수 생성
-- ============================================

-- 기존 함수 삭제 (OUT 파라미터 정의가 다를 수 있으므로)
DROP FUNCTION IF EXISTS get_all_users();

-- RLS를 우회하여 모든 사용자를 조회하는 함수
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
    id UUID,
    username VARCHAR(50),
    display_name VARCHAR(100),
    role VARCHAR(20),
    branch_id UUID,
    branch_name VARCHAR(100),
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
        u.id,
        u.username,
        u.display_name,
        u.role,
        u.branch_id,
        b.name as branch_name,
        u.is_active,
        u.created_at,
        u.updated_at
    FROM public.users u
    LEFT JOIN public.branches b ON u.branch_id = b.id
    ORDER BY u.created_at DESC;
END;
$$;

-- 함수 권한 설정 (모든 인증된 사용자가 실행 가능)
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_all_users() IS '모든 사용자 목록 조회 (RLS 우회)';

-- ============================================
-- 테스트 쿼리
-- ============================================

-- 함수 실행 테스트
SELECT * FROM get_all_users();
