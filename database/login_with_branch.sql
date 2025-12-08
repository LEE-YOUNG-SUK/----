-- ============================================
-- 지점별 로그인 기능 추가
-- ============================================
-- 목적: 동일 아이디가 다른 지점에 존재할 수 있도록 변경
-- 적용: username + branch_id 복합 유니크 키

-- ============================================
-- STEP 0: 백업 확인
-- ============================================
-- ⚠️ 적용 전 반드시 확인:
-- 1. database/check_duplicate_users.sql 실행
-- 2. 중복 아이디가 있으면 먼저 해결 필요

-- ============================================
-- STEP 1: 기존 유니크 제약 삭제
-- ============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- ============================================
-- STEP 2: 복합 유니크 제약 추가 (username + branch_id)
-- ============================================
ALTER TABLE users 
  ADD CONSTRAINT users_username_branch_unique 
  UNIQUE (username, branch_id);

-- ============================================
-- STEP 3: 성능 최적화를 위한 인덱스 추가
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_username_branch 
  ON users(username, branch_id);

-- ============================================
-- STEP 4: 기존 로그인 함수 삭제
-- ============================================
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT, UUID) CASCADE;

-- ============================================
-- STEP 5: 새 로그인 검증 함수 (지점 포함)
-- ============================================
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

COMMENT ON FUNCTION verify_login(TEXT, TEXT, UUID) IS '지점 + 아이디 + 비밀번호로 로그인 검증';

-- ============================================
-- STEP 6: 공개 지점 목록 조회 함수 (로그인 전 접근 가능)
-- ============================================
CREATE OR REPLACE FUNCTION get_branches_for_login()
RETURNS TABLE (
  id UUID,
  code VARCHAR(20),
  name VARCHAR(100)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.code, b.name
  FROM branches b
  WHERE b.is_active = true
  ORDER BY b.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_branches_for_login() TO anon;
GRANT EXECUTE ON FUNCTION get_branches_for_login() TO authenticated;

COMMENT ON FUNCTION get_branches_for_login() IS '로그인 페이지용 활성 지점 목록 조회 (인증 불필요)';

-- ============================================
-- STEP 7: 검증 쿼리
-- ============================================

-- 1. 유니크 제약 확인
SELECT 
    conname AS "제약명",
    pg_get_constraintdef(oid) AS "제약 정의"
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND contype = 'u';

-- 2. 인덱스 확인
SELECT 
    indexname AS "인덱스명",
    indexdef AS "인덱스 정의"
FROM pg_indexes
WHERE tablename = 'users'
  AND indexname LIKE '%username%';

-- 3. 함수 생성 확인
SELECT 
    p.proname AS "함수명",
    pg_get_function_arguments(p.oid) AS "파라미터"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('verify_login', 'get_branches_for_login')
ORDER BY p.proname;

-- 4. 테스트 - 지점 목록 조회
SELECT * FROM get_branches_for_login();

-- 완료 메시지
SELECT '✅ 지점별 로그인 시스템 적용 완료!' AS status;

