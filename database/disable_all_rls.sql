-- ============================================
-- RLS(Row Level Security) 완전 제거
-- ============================================
-- 모든 테이블의 RLS를 비활성화하고 정책을 삭제합니다.
-- 권한은 애플리케이션 레벨(PermissionChecker)에서만 처리합니다.

-- ============================================
-- 1. 모든 RLS 정책 삭제
-- ============================================

-- clients 테이블 정책 삭제
DROP POLICY IF EXISTS "모든 사용자 거래처 조회 가능" ON public.clients;
DROP POLICY IF EXISTS "관리자 거래처 모든 작업 가능" ON public.clients;
DROP POLICY IF EXISTS "인증된 사용자 거래처 조회 가능" ON public.clients;
DROP POLICY IF EXISTS "인증된 사용자 거래처 생성 가능" ON public.clients;
DROP POLICY IF EXISTS "인증된 사용자 거래처 수정 가능" ON public.clients;
DROP POLICY IF EXISTS "인증된 사용자 거래처 삭제 가능" ON public.clients;

-- products 테이블 정책 삭제
DROP POLICY IF EXISTS "모든 사용자 품목 조회 가능" ON public.products;
DROP POLICY IF EXISTS "관리자 품목 모든 작업 가능" ON public.products;
DROP POLICY IF EXISTS "인증된 사용자 품목 조회 가능" ON public.products;
DROP POLICY IF EXISTS "인증된 사용자 품목 생성 가능" ON public.products;
DROP POLICY IF EXISTS "인증된 사용자 품목 수정 가능" ON public.products;
DROP POLICY IF EXISTS "인증된 사용자 품목 삭제 가능" ON public.products;

-- users 테이블 정책 삭제
DROP POLICY IF EXISTS "시스템 관리자 사용자 조회 가능" ON public.users;
DROP POLICY IF EXISTS "시스템 관리자 사용자 모든 작업 가능" ON public.users;
DROP POLICY IF EXISTS "본인 정보 조회 가능" ON public.users;
DROP POLICY IF EXISTS "서비스 역할 사용자 조회 가능" ON public.users;
DROP POLICY IF EXISTS "서비스 역할 사용자 작업 가능" ON public.users;

-- branches 테이블 정책 삭제
DROP POLICY IF EXISTS "모든 사용자 지점 조회 가능" ON public.branches;
DROP POLICY IF EXISTS "관리자 지점 모든 작업 가능" ON public.branches;
DROP POLICY IF EXISTS "인증된 사용자 지점 조회 가능" ON public.branches;
DROP POLICY IF EXISTS "인증된 사용자 지점 모든 작업 가능" ON public.branches;

-- sessions 테이블 정책 삭제
DROP POLICY IF EXISTS "시스템 관리자는 모든 세션 조회 가능" ON public.sessions;
DROP POLICY IF EXISTS "서비스 역할은 모든 세션 작업 가능" ON public.sessions;

-- ============================================
-- 2. 모든 테이블의 RLS 비활성화
-- ============================================

ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. 확인 쿼리
-- ============================================

-- RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('clients', 'products', 'users', 'branches', 'sessions')
ORDER BY tablename;

-- 남아있는 정책 확인 (비어있어야 함)
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('clients', 'products', 'users', 'branches', 'sessions')
ORDER BY tablename, policyname;

-- ============================================
-- 완료!
-- ============================================
-- RLS가 완전히 제거되었습니다.
-- 이제 모든 권한은 애플리케이션 레벨에서 처리됩니다:
-- - 페이지 레벨: PermissionChecker
-- - UI 레벨: usePermissions 훅
-- - 서버 액션: 세션 확인 + 권한 체크
