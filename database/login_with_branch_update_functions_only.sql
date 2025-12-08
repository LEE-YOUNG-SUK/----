-- ============================================
-- verify_login 함수만 타입 수정 (재실행용)
-- ============================================
-- 목적: 이미 제약 조건은 생성되어 있고, 함수만 재생성

-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT, UUID) CASCADE;

-- 2. 타입 수정된 verify_login 함수 생성
CREATE OR REPLACE FUNCTION verify_login(
  p_username TEXT,
  p_password TEXT,
  p_branch_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_id UUID,
  username VARCHAR(50),      -- TEXT → VARCHAR(50)
  display_name VARCHAR(100), -- TEXT → VARCHAR(100)
  role VARCHAR(20),          -- TEXT → VARCHAR(20)
  branch_id UUID,
  branch_name VARCHAR(100)   -- TEXT → VARCHAR(100)
)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- 지점 + 아이디로 사용자 찾기
  SELECT u.*, b.name as b_name
  INTO v_user
  FROM users u
  LEFT JOIN branches b ON u.branch_id = b.id
  WHERE u.username = p_username
    AND u.branch_id = p_branch_id
    AND u.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      '아이디 또는 지점이 올바르지 않습니다.'::TEXT, 
      NULL::UUID, 
      NULL::VARCHAR(50), 
      NULL::VARCHAR(100), 
      NULL::VARCHAR(20), 
      NULL::UUID, 
      NULL::VARCHAR(100);
    RETURN;
  END IF;

  -- 비밀번호 확인
  IF v_user.password_hash != extensions.crypt(p_password, v_user.password_hash) THEN
    RETURN QUERY SELECT 
      FALSE, 
      '비밀번호가 올바르지 않습니다.'::TEXT,
      NULL::UUID, 
      NULL::VARCHAR(50), 
      NULL::VARCHAR(100), 
      NULL::VARCHAR(20), 
      NULL::UUID, 
      NULL::VARCHAR(100);
    RETURN;
  END IF;

  -- 마지막 로그인 시간 업데이트
  UPDATE users
  SET last_login_at = NOW()
  WHERE id = v_user.id;

  -- 성공
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

GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT, UUID) TO authenticated;

-- 3. 검증
SELECT '✅ verify_login 함수 타입 수정 완료!' AS status;

-- 4. 함수 확인
SELECT 
    p.proname AS "함수명",
    pg_get_function_result(p.oid) AS "반환 타입"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'verify_login';

-- 5. 테스트 - 지점 목록 조회
SELECT * FROM get_branches_for_login();

