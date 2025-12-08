-- ============================================
-- 시스템 관리자 로그인 수정
-- ============================================
-- 작성일: 2025-01-26
-- 문제: admin 계정 로그인 시 "아이디 또는 지점이 올바르지 않습니다" 에러
-- 원인: verify_login 함수가 시스템 관리자의 경우를 처리하지 않음
-- 해결: 시스템 관리자는 branch_id 체크를 건너뛰도록 수정

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT, UUID) CASCADE;

-- 새 함수 생성 (시스템 관리자 처리 추가)
CREATE OR REPLACE FUNCTION verify_login(
  p_username TEXT,
  p_password TEXT,
  p_branch_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_id UUID,
  username VARCHAR(50),
  display_name VARCHAR(100),
  role VARCHAR(20),
  branch_id UUID,
  branch_name VARCHAR(100)
)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- ============================================
  -- 1단계: username으로 사용자 찾기 (branch_id 체크 안 함!)
  -- ============================================
  SELECT u.*, b.name as b_name INTO v_user
  FROM users u
  LEFT JOIN branches b ON u.branch_id = b.id
  WHERE u.username = p_username
    AND u.is_active = true;

  -- 사용자 없음
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      '아이디 또는 비밀번호가 올바르지 않습니다.'::TEXT, 
      NULL::UUID, 
      NULL::VARCHAR(50), 
      NULL::VARCHAR(100), 
      NULL::VARCHAR(20), 
      NULL::UUID, 
      NULL::VARCHAR(100);
    RETURN;
  END IF;

  -- ============================================
  -- 2단계: 비밀번호 확인
  -- ============================================
  IF v_user.password_hash != extensions.crypt(p_password, v_user.password_hash) THEN
    RETURN QUERY SELECT 
      FALSE, 
      '아이디 또는 비밀번호가 올바르지 않습니다.'::TEXT, 
      NULL::UUID, 
      NULL::VARCHAR(50), 
      NULL::VARCHAR(100), 
      NULL::VARCHAR(20), 
      NULL::UUID, 
      NULL::VARCHAR(100);
    RETURN;
  END IF;

  -- ============================================
  -- 3단계: 지점 체크 (시스템 관리자는 건너뛰기!)
  -- ============================================
  IF v_user.role != '0000' THEN
    -- 일반 사용자: 지점 체크 필수
    IF v_user.branch_id IS NULL THEN
      RETURN QUERY SELECT 
        FALSE, 
        '지점이 설정되지 않은 사용자입니다.'::TEXT, 
        NULL::UUID, 
        NULL::VARCHAR(50), 
        NULL::VARCHAR(100), 
        NULL::VARCHAR(20), 
        NULL::UUID, 
        NULL::VARCHAR(100);
      RETURN;
    END IF;

    IF v_user.branch_id != p_branch_id THEN
      RETURN QUERY SELECT 
        FALSE, 
        '선택한 지점이 올바르지 않습니다.'::TEXT, 
        NULL::UUID, 
        NULL::VARCHAR(50), 
        NULL::VARCHAR(100), 
        NULL::VARCHAR(20), 
        NULL::UUID, 
        NULL::VARCHAR(100);
      RETURN;
    END IF;
  ELSE
    -- ✅ 시스템 관리자: 지점 체크 건너뛰기
    -- p_branch_id는 무시됨
    RAISE NOTICE '✅ 시스템 관리자 로그인: branch_id 체크 건너뜀';
  END IF;

  -- ============================================
  -- 4단계: 로그인 성공
  -- ============================================
  RETURN QUERY SELECT 
    TRUE, 
    '로그인 성공'::TEXT, 
    v_user.id, 
    v_user.username, 
    v_user.display_name, 
    v_user.role, 
    v_user.branch_id, 
    v_user.b_name;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT, UUID) TO authenticated;

-- 확인
SELECT '✅ verify_login 함수 수정 완료! (시스템 관리자 지점 체크 건너뛰기)' AS status;

-- 테스트 쿼리 (실제 admin 비밀번호로 테스트)
-- SELECT * FROM verify_login('admin', '실제비밀번호', (SELECT id FROM branches WHERE code = 'HQ'));

