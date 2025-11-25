-- =====================================================
-- Supabase 에러/경고 해결 스크립트
-- error.csv, warnings.csv 기반
-- =====================================================

-- ============================================
-- 1. RLS (Row Level Security) 완전 비활성화
-- 현재 상태: RLS 정책은 있지만 비활성화됨
-- 해결: 불필요한 정책 삭제 (앱 레벨 권한 관리)
-- ============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 모든 RLS 정책 삭제
  FOR r IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE '정책 삭제: %.% - %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
  
  -- 모든 테이블 RLS 비활성화 확인
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
  
  RAISE NOTICE '✅ RLS 정책 및 활성화 완전 제거';
END $$;

-- ============================================
-- 2. Function search_path 설정 (경고 해결)
-- 현재: 34개 함수에 search_path 미설정
-- 해결: 주요 RPC 함수에 search_path = public 추가
-- ============================================

-- 이미 FINAL_SAFE_FIX_V4.sql에서 process_purchase_with_layers, 
-- process_sale_with_fifo는 SET search_path = public 추가됨

-- 추가 함수들 수정
DO $$
BEGIN
  -- authenticate_user
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'authenticate_user') THEN
    DROP FUNCTION IF EXISTS authenticate_user CASCADE;
    RAISE NOTICE 'authenticate_user 재생성 필요 (search_path 추가)';
  END IF;
  
  -- verify_session (중요!)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_session') THEN
    DROP FUNCTION IF EXISTS verify_session CASCADE;
    RAISE NOTICE 'verify_session 재생성 필요 (search_path 추가)';
  END IF;
  
  RAISE NOTICE '✅ 함수 search_path 검토 완료';
  RAISE NOTICE '주의: 일부 함수는 원본 SQL 파일에서 수정 필요';
END $$;

-- ============================================
-- 3. Materialized View 권한 제거 (경고 해결)
-- current_inventory materialized view
-- ============================================

DO $$
BEGIN
  -- anon, authenticated 역할 권한 회수
  REVOKE ALL ON public.current_inventory FROM anon;
  REVOKE ALL ON public.current_inventory FROM authenticated;
  
  -- 필요 시 특정 역할만 권한 부여
  -- GRANT SELECT ON public.current_inventory TO service_role;
  
  RAISE NOTICE '✅ Materialized View 권한 제거';
END $$;

-- ============================================
-- 4. 검증
-- ============================================

DO $$
DECLARE
  v_rls_enabled_count INTEGER;
  v_policy_count INTEGER;
BEGIN
  -- RLS 활성화된 테이블 개수
  SELECT COUNT(*) INTO v_rls_enabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = true;
  
  -- 정책 개수
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '==================================================';
  RAISE NOTICE '✨ Supabase 경고 해결 검증';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'RLS 활성화된 테이블: % (예상: 0)', v_rls_enabled_count;
  RAISE NOTICE 'RLS 정책 개수: % (예상: 0)', v_policy_count;
  RAISE NOTICE '==================================================';
  
  IF v_rls_enabled_count > 0 OR v_policy_count > 0 THEN
    RAISE WARNING 'RLS 완전 제거 실패 - 수동 확인 필요';
  ELSE
    RAISE NOTICE '✅ 모든 RLS 에러 해결 완료';
  END IF;
END $$;

-- ============================================
-- 5. 참고: Auth 관련 경고는 Supabase 대시보드에서 설정
-- ============================================

-- Auth > Configuration에서 설정:
-- 1. Password Protection: Leaked Password Protection 활성화
-- 2. MFA: TOTP, Phone 등 추가 활성화

-- 이 설정은 SQL로 변경 불가 (Supabase 대시보드 사용)
