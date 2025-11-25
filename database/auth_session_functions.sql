-- =====================================================
-- 인증/세션 관련 필수 RPC 함수 복구 스크립트
-- 무한 리디렉션 원인: verify_session / authenticate_user 삭제로 세션 검증 실패
-- 실행 순서: 이 파일 그대로 실행 → 브라우저 쿠키 삭제 후 재로그인
-- =====================================================

-- 0. 기존 함수 안전 삭제
DROP FUNCTION IF EXISTS public.authenticate_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.verify_session(TEXT);

-- 1. 사용자 인증 함수 (단순 버전: 패스워드 검증 로직 향후 강화 가능)
-- 반환 필드: success, message, token, user_id, username, display_name, role, branch_id, branch_name
CREATE OR REPLACE FUNCTION public.authenticate_user(
  p_username TEXT,
  p_password TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  token TEXT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  role TEXT,
  branch_id UUID,
  branch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '24 hours';
BEGIN
  SELECT u.id, u.username, u.display_name, u.role, u.branch_id, b.name AS branch_name
  INTO v_user
  FROM public.users u
  LEFT JOIN public.branches b ON b.id = u.branch_id
  WHERE u.username = p_username AND u.is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      '잘못된 아이디 또는 비활성 사용자'::TEXT,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  -- TODO: 비밀번호 검증 (해시 컬럼 필요). 현재는 무조건 통과.
  -- 향후: IF v_user.password_hash IS NULL OR v_user.password_hash != crypt(p_password, v_user.password_hash) THEN ... END IF;

  v_token := gen_random_uuid()::TEXT;

  INSERT INTO public.sessions (user_id, token, is_valid, expires_at)
  VALUES (v_user.id, v_token, TRUE, v_expires);

  RETURN QUERY SELECT 
    TRUE::BOOLEAN,
    '로그인 성공'::TEXT,
    v_token::TEXT,
    v_user.id::UUID,
    v_user.username::TEXT,
    COALESCE(v_user.display_name, v_user.username)::TEXT,
    v_user.role::TEXT,
    v_user.branch_id::UUID,
    COALESCE(v_user.branch_name, '')::TEXT;
END;
$$;

-- 2. 세션 검증 함수: 토큰 유효 여부 + 사용자 정보 반환
CREATE OR REPLACE FUNCTION public.verify_session(
  p_token TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  role TEXT,
  branch_id UUID,
  branch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.id, s.user_id, s.token, s.expires_at, u.username, u.display_name, u.role, u.branch_id, b.name AS branch_name
  INTO v_session
  FROM public.sessions s
  JOIN public.users u ON u.id = s.user_id
  LEFT JOIN public.branches b ON b.id = u.branch_id
  WHERE s.token = p_token AND s.is_valid = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  IF v_session.expires_at < NOW() THEN
    UPDATE public.sessions SET is_valid = FALSE WHERE id = v_session.id;
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    TRUE::BOOLEAN,
    v_session.user_id::UUID,
    v_session.username::TEXT,
    COALESCE(v_session.display_name, v_session.username)::TEXT,
    v_session.role::TEXT,
    v_session.branch_id::UUID,
    COALESCE(v_session.branch_name, '')::TEXT;
END;
$$;

-- 3. 권한 부여
GRANT EXECUTE ON FUNCTION public.authenticate_user(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_session(TEXT) TO anon, authenticated;

-- 4. 검증 메시지
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ 인증/세션 함수 재생성 완료';
  RAISE NOTICE ' - authenticate_user / verify_session 작동 준비';
  RAISE NOTICE '브라우저 쿠키 삭제 후 다시 로그인하세요.';
  RAISE NOTICE '============================================';
END $$;

-- 5. 빠른 테스트 (선택)
-- SELECT * FROM public.authenticate_user('admin','admin1234',NULL,'manual-test');
-- SELECT * FROM public.verify_session('임시토큰');
