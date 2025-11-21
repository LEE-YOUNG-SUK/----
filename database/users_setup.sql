-- ============================================
-- 사용자(users) 및 지점(branches) 테이블 연결 확인
-- ============================================

-- 참고: users와 branches 테이블은 이미 존재하므로
-- 필요한 컬럼과 인덱스, RLS 정책만 확인/추가합니다.

-- ============================================
-- 1. 테이블 존재 확인
-- ============================================

-- users 테이블이 있는지 확인 (있어야 함)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'users 테이블이 존재하지 않습니다. 먼저 users 테이블을 생성해주세요.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'branches 테이블이 존재하지 않습니다. 먼저 branches 테이블을 생성해주세요.';
    END IF;
    
    RAISE NOTICE 'users와 branches 테이블이 존재합니다.';
END $$;

-- ============================================
-- 2. users 테이블 필수 컬럼 확인 및 추가
-- ============================================

-- display_name 컬럼 추가 (없으면)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN display_name TEXT;
        RAISE NOTICE 'display_name 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'display_name 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- role 컬럼 확인 (필수)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT '0003';
        RAISE NOTICE 'role 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'role 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- branch_id 컬럼 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'branch_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN branch_id UUID REFERENCES public.branches(id);
        RAISE NOTICE 'branch_id 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'branch_id 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- is_active 컬럼 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'is_active 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'is_active 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- ============================================
-- 3. branches 테이블 필수 컬럼 확인
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'branches' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'branches.is_active 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'branches.is_active 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- ============================================
-- 4. 인덱스 생성 (기존 인덱스가 있으면 건너뜀)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

CREATE INDEX IF NOT EXISTS idx_branches_code ON public.branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_name ON public.branches(name);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON public.branches(is_active);

-- ============================================
-- 5. RLS (Row Level Security) 활성화
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS 정책 생성 (기존 정책이 있으면 건너뜀)
-- ============================================

-- users 테이블 정책
DO $$ 
BEGIN
    -- 모든 사용자 조회 가능 (시스템 관리자만)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = '시스템 관리자 사용자 조회 가능'
    ) THEN
        CREATE POLICY "시스템 관리자 사용자 조회 가능" ON public.users
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role = '0000'
                )
            );
    END IF;

    -- 시스템 관리자 모든 작업 가능
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = '시스템 관리자 사용자 모든 작업 가능'
    ) THEN
        CREATE POLICY "시스템 관리자 사용자 모든 작업 가능" ON public.users
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.role = '0000'
                )
            );
    END IF;

    -- 자신의 정보 조회 가능
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = '본인 정보 조회 가능'
    ) THEN
        CREATE POLICY "본인 정보 조회 가능" ON public.users
            FOR SELECT
            USING (id = auth.uid());
    END IF;
END $$;

-- branches 테이블 정책
DO $$ 
BEGIN
    -- 모든 사용자 지점 조회 가능
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'branches' 
        AND policyname = '모든 사용자 지점 조회 가능'
    ) THEN
        CREATE POLICY "모든 사용자 지점 조회 가능" ON public.branches
            FOR SELECT
            USING (true);
    END IF;

    -- 시스템 관리자 지점 모든 작업 가능
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'branches' 
        AND policyname = '관리자 지점 모든 작업 가능'
    ) THEN
        CREATE POLICY "관리자 지점 모든 작업 가능" ON public.branches
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE users.id = auth.uid()
                    AND users.role = '0000'
                )
            );
    END IF;
END $$;

-- ============================================
-- 7. updated_at 자동 업데이트 트리거
-- ============================================

-- update_updated_at_column 함수가 없으면 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- users 테이블 트리거
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- branches 테이블 트리거
DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at 
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. 코멘트 추가
-- ============================================

COMMENT ON TABLE public.users IS '사용자 정보';
COMMENT ON COLUMN public.users.id IS '사용자 ID';
COMMENT ON COLUMN public.users.username IS '로그인 아이디';
COMMENT ON COLUMN public.users.display_name IS '표시 이름';
COMMENT ON COLUMN public.users.role IS '권한 (0000: 시스템관리자, 0001: 원장, 0002: 매니저, 0003: 사용자)';
COMMENT ON COLUMN public.users.branch_id IS '소속 지점 ID';
COMMENT ON COLUMN public.users.is_active IS '활성 상태';

COMMENT ON TABLE public.branches IS '지점 정보';
COMMENT ON COLUMN public.branches.id IS '지점 ID';
COMMENT ON COLUMN public.branches.code IS '지점 코드';
COMMENT ON COLUMN public.branches.name IS '지점명';
COMMENT ON COLUMN public.branches.is_active IS '활성 상태';

-- ============================================
-- 9. 데이터 확인 쿼리
-- ============================================

-- 모든 사용자 조회
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.role,
    u.branch_id,
    b.name as branch_name,
    u.is_active,
    u.created_at
FROM public.users u
LEFT JOIN public.branches b ON u.branch_id = b.id
ORDER BY u.created_at DESC;

-- 모든 지점 조회
SELECT * FROM public.branches ORDER BY code;

-- 권한별 사용자 수
SELECT 
    role,
    CASE role
        WHEN '0000' THEN '시스템 관리자'
        WHEN '0001' THEN '원장'
        WHEN '0002' THEN '매니저'
        WHEN '0003' THEN '사용자'
        ELSE '알 수 없음'
    END as role_name,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM public.users
GROUP BY role
ORDER BY role;

-- 지점별 사용자 수
SELECT 
    b.name as branch_name,
    COUNT(u.id) as user_count
FROM public.branches b
LEFT JOIN public.users u ON b.id = u.branch_id AND u.is_active = true
WHERE b.is_active = true
GROUP BY b.id, b.name
ORDER BY b.name;
