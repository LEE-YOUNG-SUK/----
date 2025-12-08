-- ============================================
-- 사용자 관리 RPC 함수 생성 (원장 권한 추가)
-- ============================================
-- 주의: 기존 함수를 명시적으로 삭제 후 재생성합니다.

-- ============================================
-- STEP 0: 필수 확장 활성화
-- ============================================

-- pgcrypto 확장 필요 (비밀번호 해시용: crypt, gen_salt 함수)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- STEP 1: 기존 함수 명시적 삭제
-- ============================================

-- get_all_users 모든 버전 삭제
DROP FUNCTION IF EXISTS get_all_users() CASCADE;
DROP FUNCTION IF EXISTS get_all_users(TEXT, UUID) CASCADE;

-- create_user 모든 버전 삭제 (파라미터 순서 주의)
DROP FUNCTION IF EXISTS create_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_user(VARCHAR(50), TEXT, VARCHAR(100), VARCHAR(20), UUID, UUID) CASCADE;

-- update_user 모든 버전 삭제
DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR, VARCHAR, UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR, VARCHAR, UUID, BOOLEAN, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN, UUID, VARCHAR(20)) CASCADE;

-- delete_user 모든 버전 삭제
DROP FUNCTION IF EXISTS delete_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS delete_user(UUID, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS delete_user(UUID, UUID, VARCHAR(20)) CASCADE;

-- update_user_password 모든 버전 삭제
DROP FUNCTION IF EXISTS update_user_password(UUID, TEXT) CASCADE;

-- ============================================
-- STEP 2: 새 함수 생성
-- ============================================

-- ============================================
-- 1. RLS를 우회하여 사용자를 조회하는 함수 (권한별 지점 격리)
-- ============================================
CREATE OR REPLACE FUNCTION get_all_users(
    p_user_role TEXT,
    p_user_branch_id UUID
)
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
    -- 시스템 관리자(0000): 전체 사용자 조회
    IF p_user_role = '0000' THEN
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
    
    -- 원장(0001): 본인 지점 사용자만 조회 (다른 원장/시스템관리자 제외)
    ELSIF p_user_role = '0001' THEN
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
        WHERE u.branch_id = p_user_branch_id
          AND u.role IN ('0002', '0003')  -- 매니저, 사용자만
        ORDER BY u.created_at DESC;
    
    -- 기타 권한: 조회 불가 (빈 결과 반환)
    ELSE
        RETURN QUERY
        SELECT 
            NULL::UUID, NULL::VARCHAR(50), NULL::VARCHAR(100), NULL::VARCHAR(20),
            NULL::UUID, NULL::VARCHAR(100), NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ
        WHERE FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users(TEXT, UUID) TO authenticated;
COMMENT ON FUNCTION get_all_users(TEXT, UUID) IS '권한별 사용자 목록 조회 (지점 격리 적용)';

-- ============================================
-- 2. 사용자 생성 함수 (권한 검증 추가)
-- ============================================
CREATE OR REPLACE FUNCTION create_user(
    p_username VARCHAR(50),
    p_password TEXT,
    p_display_name VARCHAR(100),
    p_role VARCHAR(20),
    p_branch_id UUID,
    p_created_by UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    user_id UUID
)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_hashed_password TEXT;
    v_creator_role VARCHAR(20);
    v_creator_branch_id UUID;
BEGIN
    -- 생성자의 권한 확인
    SELECT role, branch_id INTO v_creator_role, v_creator_branch_id
    FROM public.users
    WHERE id = p_created_by;

    -- 원장(0001)이 생성하는 경우
    IF v_creator_role = '0001' THEN
        -- 원장은 시스템관리자(0000)나 다른 원장(0001) 생성 불가
        IF p_role IN ('0000', '0001') THEN
            RETURN QUERY SELECT FALSE, '원장은 시스템 관리자나 원장을 생성할 수 없습니다.'::TEXT, NULL::UUID;
            RETURN;
        END IF;
        
        -- 원장이 생성하는 사용자는 자동으로 본인 지점 소속
        p_branch_id := v_creator_branch_id;
    END IF;

    -- 아이디 중복 체크
    IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
        RETURN QUERY SELECT FALSE, '이미 존재하는 아이디입니다.'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- 비밀번호 해시 (extensions 스키마 명시)
    v_hashed_password := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    -- 사용자 생성
    INSERT INTO public.users (username, password_hash, display_name, role, branch_id, is_active)
    VALUES (p_username, v_hashed_password, p_display_name, p_role, p_branch_id, TRUE)
    RETURNING id INTO v_user_id;

    RETURN QUERY SELECT TRUE, '사용자가 생성되었습니다.'::TEXT, v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_user(VARCHAR(50), TEXT, VARCHAR(100), VARCHAR(20), UUID, UUID) TO authenticated;
COMMENT ON FUNCTION create_user(VARCHAR(50), TEXT, VARCHAR(100), VARCHAR(20), UUID, UUID) IS '사용자 생성 (권한 검증 포함)';

-- ============================================
-- 3. 사용자 수정 함수 (권한 검증 추가)
-- ============================================
CREATE OR REPLACE FUNCTION update_user(
    p_user_id UUID,
    p_display_name VARCHAR(100),
    p_role VARCHAR(20),
    p_branch_id UUID,
    p_is_active BOOLEAN,
    p_updated_by UUID,
    p_updater_role VARCHAR(20)
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
    v_target_role VARCHAR(20);
    v_target_branch_id UUID;
    v_updater_branch_id UUID;
BEGIN
    -- 수정 대상 사용자 정보 조회
    SELECT role, branch_id INTO v_target_role, v_target_branch_id
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '존재하지 않는 사용자입니다.'::TEXT;
        RETURN;
    END IF;

    -- 원장(0001)이 수정하는 경우
    IF p_updater_role = '0001' THEN
        -- 수정자의 지점 정보 조회
        SELECT branch_id INTO v_updater_branch_id
        FROM public.users
        WHERE id = p_updated_by;

        -- 본인 지점 사용자만 수정 가능
        IF v_target_branch_id != v_updater_branch_id THEN
            RETURN QUERY SELECT FALSE, '다른 지점 사용자는 수정할 수 없습니다.'::TEXT;
            RETURN;
        END IF;

        -- 본인보다 높은 권한(0000, 0001) 수정 불가
        IF v_target_role IN ('0000', '0001') THEN
            RETURN QUERY SELECT FALSE, '원장은 시스템 관리자나 원장을 수정할 수 없습니다.'::TEXT;
            RETURN;
        END IF;

        -- 원장이 수정 시 지점 변경 불가 (본인 지점 고정)
        p_branch_id := v_updater_branch_id;
    END IF;

    -- 사용자 정보 업데이트
    UPDATE public.users
    SET 
        display_name = p_display_name,
        role = p_role,
        branch_id = p_branch_id,
        is_active = p_is_active,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, '사용자 정보가 수정되었습니다.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN, UUID, VARCHAR(20)) TO authenticated;
COMMENT ON FUNCTION update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN, UUID, VARCHAR(20)) IS '사용자 정보 수정 (권한 검증 포함)';

-- ============================================
-- 4. 사용자 삭제 함수 (권한 검증 추가)
-- ============================================
CREATE OR REPLACE FUNCTION delete_user(
    p_user_id UUID,
    p_deleted_by UUID,
    p_deleter_role VARCHAR(20)
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
    v_target_role VARCHAR(20);
    v_target_branch_id UUID;
    v_deleter_branch_id UUID;
BEGIN
    -- 삭제 대상 사용자 정보 조회
    SELECT role, branch_id INTO v_target_role, v_target_branch_id
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, '존재하지 않는 사용자입니다.'::TEXT;
        RETURN;
    END IF;

    -- 원장(0001)이 삭제하는 경우
    IF p_deleter_role = '0001' THEN
        -- 삭제자의 지점 정보 조회
        SELECT branch_id INTO v_deleter_branch_id
        FROM public.users
        WHERE id = p_deleted_by;

        -- 본인 지점 사용자만 삭제 가능
        IF v_target_branch_id != v_deleter_branch_id THEN
            RETURN QUERY SELECT FALSE, '다른 지점 사용자는 삭제할 수 없습니다.'::TEXT;
            RETURN;
        END IF;

        -- 본인보다 높은 권한(0000, 0001) 삭제 불가
        IF v_target_role IN ('0000', '0001') THEN
            RETURN QUERY SELECT FALSE, '원장은 시스템 관리자나 원장을 삭제할 수 없습니다.'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 사용자 삭제
    DELETE FROM public.users WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, '사용자가 삭제되었습니다.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user(UUID, UUID, VARCHAR(20)) TO authenticated;
COMMENT ON FUNCTION delete_user(UUID, UUID, VARCHAR(20)) IS '사용자 삭제 (권한 검증 포함)';

-- ============================================
-- 5. 비밀번호 변경 함수 (기존 유지)
-- ============================================
CREATE OR REPLACE FUNCTION update_user_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    v_hashed_password TEXT;
BEGIN
    -- 사용자 존재 여부 확인
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
        RETURN QUERY SELECT FALSE, '존재하지 않는 사용자입니다.'::TEXT;
        RETURN;
    END IF;

    -- 비밀번호 해시 (extensions 스키마 명시)
    v_hashed_password := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));

    -- 비밀번호 업데이트
    UPDATE public.users
    SET 
        password_hash = v_hashed_password,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, '비밀번호가 변경되었습니다.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_password(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION update_user_password(UUID, TEXT) IS '사용자 비밀번호 변경';

-- ============================================
-- STEP 3: 검증 쿼리
-- ============================================

-- 1. 함수 생성 확인
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_all_users',
    'create_user',
    'update_user',
    'delete_user',
    'update_user_password'
  )
ORDER BY p.proname;

-- 2. 간단 테스트 (시스템 관리자로 조회)
-- SELECT * FROM get_all_users('0000', NULL);

