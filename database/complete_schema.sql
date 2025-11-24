-- ======================================
-- File: sessions_table.sql
-- ======================================

-- sessions 테이블 생성
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON public.sessions(is_valid);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (시스템 관리자만 접근 가능)
CREATE POLICY "시스템 관리자는 모든 세션 조회 가능" ON public.sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '0000'
        )
    );

-- 서비스 역할로 모든 작업 허용 (서버에서 세션 관리)
CREATE POLICY "서비스 역할은 모든 세션 작업 가능" ON public.sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE public.sessions IS '사용자 세션 정보';
COMMENT ON COLUMN public.sessions.id IS '세션 ID';
COMMENT ON COLUMN public.sessions.user_id IS '사용자 ID';
COMMENT ON COLUMN public.sessions.token IS '세션 토큰';
COMMENT ON COLUMN public.sessions.is_valid IS '세션 유효 여부';
COMMENT ON COLUMN public.sessions.created_at IS '생성 시각';
COMMENT ON COLUMN public.sessions.expires_at IS '만료 시각';
COMMENT ON COLUMN public.sessions.last_activity IS '마지막 활동 시각';



-- ======================================
-- File: users_setup.sql
-- ======================================

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


-- business_number 컬럼 추가 (없으면)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'branches' 
        AND column_name = 'business_number'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.branches ADD COLUMN business_number TEXT;
        RAISE NOTICE 'business_number 컬럼을 추가했습니다.';
    ELSE
        RAISE NOTICE 'business_number 컬럼이 이미 존재합니다.';
    END IF;
END $$;

COMMENT ON TABLE public.branches IS '지점 정보';
COMMENT ON COLUMN public.branches.id IS '지점 ID';
COMMENT ON COLUMN public.branches.code IS '지점 코드';
COMMENT ON COLUMN public.branches.name IS '지점명';
COMMENT ON COLUMN public.branches.business_number IS '사업자번호';
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



-- ======================================
-- File: clients_table.sql
-- ======================================

-- ============================================
-- 거래처(clients) 테이블 생성 및 설정
-- ============================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('supplier', 'customer', 'both')),
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tax_id TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.clients(is_active);

-- 3. RLS (Row Level Security) 활성화
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
-- 모든 인증된 사용자는 조회 가능
CREATE POLICY "모든 사용자 거래처 조회 가능" ON public.clients
    FOR SELECT
    USING (true);

-- 시스템 관리자와 원장은 모든 작업 가능
CREATE POLICY "관리자 거래처 모든 작업 가능" ON public.clients
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('0000', '0001')
        )
    );

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 코멘트 추가
COMMENT ON TABLE public.clients IS '거래처 정보 (공급업체/고객)';
COMMENT ON COLUMN public.clients.id IS '거래처 ID';
COMMENT ON COLUMN public.clients.code IS '거래처 코드 (고유)';
COMMENT ON COLUMN public.clients.name IS '거래처명/상호명';
COMMENT ON COLUMN public.clients.type IS '거래처 유형 (supplier: 공급업체, customer: 고객, both: 둘 다)';
COMMENT ON COLUMN public.clients.contact_person IS '담당자명';
COMMENT ON COLUMN public.clients.phone IS '연락처';
COMMENT ON COLUMN public.clients.email IS '이메일';
COMMENT ON COLUMN public.clients.address IS '주소';
COMMENT ON COLUMN public.clients.tax_id IS '사업자등록번호';
COMMENT ON COLUMN public.clients.notes IS '비고';
COMMENT ON COLUMN public.clients.is_active IS '활성 상태';
COMMENT ON COLUMN public.clients.created_at IS '생성 일시';
COMMENT ON COLUMN public.clients.updated_at IS '수정 일시';

-- ============================================
-- 샘플 데이터 삽입 (선택사항)
-- ============================================

INSERT INTO public.clients (code, name, type, contact_person, phone, email, address, is_active)
VALUES 
    ('SUP001', '(주)한국자재유통', 'supplier', '김철수', '02-1234-5678', 'kim@example.com', '서울시 강남구', true),
    ('SUP002', '대한물류센터', 'supplier', '이영희', '02-2345-6789', 'lee@example.com', '경기도 성남시', true),
    ('CUS001', '서울마트', 'customer', '박민수', '02-3456-7890', 'park@example.com', '서울시 송파구', true),
    ('CUS002', '부산슈퍼', 'customer', '최지영', '051-456-7890', 'choi@example.com', '부산시 해운대구', true),
    ('BOTH001', '전국유통', 'both', '정호진', '02-5678-9012', 'jung@example.com', '서울시 마포구', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 데이터 확인 쿼리
-- ============================================

-- 모든 거래처 조회
SELECT * FROM public.clients ORDER BY code;

-- 거래처 수 확인
SELECT 
    type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM public.clients
GROUP BY type;



-- ======================================
-- File: products_table.sql
-- ======================================

-- ============================================
-- 품목(products) 테이블 생성 및 설정
-- ============================================

-- 1. 테이블 생성 (기존 테이블이 있으면 건너뜀)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    specification TEXT,
    manufacturer TEXT,
    barcode TEXT,
    min_stock_level INTEGER,
    standard_purchase_price DECIMAL(15, 2),
    standard_sale_price DECIMAL(15, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 인덱스 생성 (기존 인덱스가 있으면 건너뜀)
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- 3. RLS (Row Level Security) 활성화 (이미 활성화되어 있어도 안전)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성 (기존 정책이 있으면 에러 발생하지만 무시 가능)
DO $$ 
BEGIN
    -- 조회 정책
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' 
        AND policyname = '모든 사용자 품목 조회 가능'
    ) THEN
        CREATE POLICY "모든 사용자 품목 조회 가능" ON public.products
            FOR SELECT
            USING (true);
    END IF;

    -- 관리자 전체 작업 정책
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' 
        AND policyname = '관리자 품목 모든 작업 가능'
    ) THEN
        CREATE POLICY "관리자 품목 모든 작업 가능" ON public.products
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE users.id = auth.uid()
                    AND users.role IN ('0000', '0001')
                )
            );
    END IF;
END $$;

-- 5. updated_at 자동 업데이트 트리거 (기존 트리거 삭제 후 재생성)
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 코멘트 추가
COMMENT ON TABLE public.products IS '품목 정보';
COMMENT ON COLUMN public.products.id IS '품목 ID';
COMMENT ON COLUMN public.products.code IS '품목 코드 (고유)';
COMMENT ON COLUMN public.products.name IS '품목명';
COMMENT ON COLUMN public.products.category IS '카테고리';
COMMENT ON COLUMN public.products.unit IS '단위 (EA, BOX, KG 등)';
COMMENT ON COLUMN public.products.specification IS '규격/사양';
COMMENT ON COLUMN public.products.manufacturer IS '제조사';
COMMENT ON COLUMN public.products.barcode IS '바코드';
COMMENT ON COLUMN public.products.min_stock_level IS '최소 재고 수준';
COMMENT ON COLUMN public.products.standard_purchase_price IS '표준 매입가';
COMMENT ON COLUMN public.products.standard_sale_price IS '표준 판매가';
COMMENT ON COLUMN public.products.is_active IS '활성 상태';
COMMENT ON COLUMN public.products.created_at IS '생성 일시';
COMMENT ON COLUMN public.products.updated_at IS '수정 일시';

-- ============================================
-- 샘플 데이터 삽입 (선택사항)
-- ============================================

INSERT INTO public.products (code, name, category, unit, specification, manufacturer, min_stock_level, standard_purchase_price, standard_sale_price, is_active)
VALUES 
    ('PROD001', '삼성 노트북 15인치', '전자제품', 'EA', 'RAM 16GB, SSD 512GB', '삼성전자', 10, 1200000, 1500000, true),
    ('PROD002', 'LG 모니터 27인치', '전자제품', 'EA', '4K UHD, IPS', 'LG전자', 15, 350000, 450000, true),
    ('PROD003', '로지텍 무선마우스', '주변기기', 'EA', 'MX Master 3', 'Logitech', 50, 85000, 120000, true),
    ('PROD004', 'A4 용지', '사무용품', 'BOX', '500매/박스', '한국제지', 100, 15000, 20000, true),
    ('PROD005', '볼펜 세트', '사무용품', 'SET', '검정/빨강/파랑 10자루', '모나미', 200, 5000, 8000, true),
    ('PROD006', 'USB 메모리 64GB', '저장장치', 'EA', 'USB 3.0', 'SanDisk', 30, 12000, 18000, true),
    ('PROD007', '책상 의자', '가구', 'EA', '메쉬 등받이, 높이조절', '시디즈', 20, 150000, 220000, true),
    ('PROD008', '사무용 책상', '가구', 'EA', '140x70cm, 화이트', '한샘', 10, 250000, 350000, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 데이터 확인 쿼리
-- ============================================

-- 모든 품목 조회
SELECT * FROM public.products ORDER BY code;

-- 카테고리별 품목 수
SELECT 
    category,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM public.products
GROUP BY category
ORDER BY category;

-- 재고 수준별 품목
SELECT 
    code,
    name,
    min_stock_level,
    CASE 
        WHEN min_stock_level IS NULL THEN '미설정'
        WHEN min_stock_level < 20 THEN '낮음'
        WHEN min_stock_level < 50 THEN '보통'
        ELSE '높음'
    END as stock_level_category
FROM public.products
ORDER BY min_stock_level DESC NULLS LAST;



-- ======================================
-- File: purchases_sales_inventory_tables.sql
-- ======================================

-- =====================================================
-- 입고/판매/재고 레이어 테이블 생성
-- =====================================================

-- ============================================
-- 1. purchases 테이블 (입고)
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(15, 2) NOT NULL CHECK (total_cost >= 0),
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_client_id ON public.purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON public.purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);

-- 코멘트
COMMENT ON TABLE public.purchases IS '입고 내역';
COMMENT ON COLUMN public.purchases.id IS '입고 ID';
COMMENT ON COLUMN public.purchases.branch_id IS '지점 ID';
COMMENT ON COLUMN public.purchases.client_id IS '공급업체 ID';
COMMENT ON COLUMN public.purchases.product_id IS '품목 ID';
COMMENT ON COLUMN public.purchases.purchase_date IS '입고일';
COMMENT ON COLUMN public.purchases.quantity IS '입고 수량';
COMMENT ON COLUMN public.purchases.unit_cost IS '입고 단가';
COMMENT ON COLUMN public.purchases.total_cost IS '총 입고액';
COMMENT ON COLUMN public.purchases.reference_number IS '참조 번호';
COMMENT ON COLUMN public.purchases.notes IS '비고';


-- ============================================
-- 2. sales 테이블 (판매)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(15, 2) NOT NULL CHECK (total_price >= 0),
    cost_of_goods_sold NUMERIC(15, 2),
    profit NUMERIC(15, 2),
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);

-- 코멘트
COMMENT ON TABLE public.sales IS '판매 내역';
COMMENT ON COLUMN public.sales.id IS '판매 ID';
COMMENT ON COLUMN public.sales.branch_id IS '지점 ID';
COMMENT ON COLUMN public.sales.client_id IS '고객 ID';
COMMENT ON COLUMN public.sales.product_id IS '품목 ID';
COMMENT ON COLUMN public.sales.sale_date IS '판매일';
COMMENT ON COLUMN public.sales.quantity IS '판매 수량';
COMMENT ON COLUMN public.sales.unit_price IS '판매 단가';
COMMENT ON COLUMN public.sales.total_price IS '총 판매액';
COMMENT ON COLUMN public.sales.cost_of_goods_sold IS 'FIFO 원가';
COMMENT ON COLUMN public.sales.profit IS '이익';


-- ============================================
-- 3. inventory_layers 테이블 (FIFO 재고 레이어)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_layers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_id TEXT REFERENCES public.purchases(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    original_quantity NUMERIC(15, 3) NOT NULL CHECK (original_quantity > 0),
    remaining_quantity NUMERIC(15, 3) NOT NULL CHECK (remaining_quantity >= 0),
    reference_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 인덱스 생성 (FIFO 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_inventory_layers_branch_product ON public.inventory_layers(branch_id, product_id, purchase_date ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_layers_remaining ON public.inventory_layers(remaining_quantity) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_layers_purchase_id ON public.inventory_layers(purchase_id);

-- 코멘트
COMMENT ON TABLE public.inventory_layers IS 'FIFO 재고 레이어';
COMMENT ON COLUMN public.inventory_layers.id IS '레이어 ID';
COMMENT ON COLUMN public.inventory_layers.branch_id IS '지점 ID';
COMMENT ON COLUMN public.inventory_layers.product_id IS '품목 ID';
COMMENT ON COLUMN public.inventory_layers.purchase_id IS '입고 ID (참조)';
COMMENT ON COLUMN public.inventory_layers.purchase_date IS '입고일 (FIFO 정렬용)';
COMMENT ON COLUMN public.inventory_layers.unit_cost IS '단위 원가';
COMMENT ON COLUMN public.inventory_layers.original_quantity IS '최초 수량';
COMMENT ON COLUMN public.inventory_layers.remaining_quantity IS '남은 수량';


-- ============================================
-- 4. RLS 비활성화
-- ============================================
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_layers DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. 트리거: 입고 시 재고 레이어 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION create_inventory_layer_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.inventory_layers (
        branch_id,
        product_id,
        purchase_id,
        purchase_date,
        unit_cost,
        original_quantity,
        remaining_quantity,
        reference_number,
        created_at
    ) VALUES (
        NEW.branch_id,
        NEW.product_id,
        NEW.id,
        NEW.purchase_date,
        NEW.unit_cost,
        NEW.quantity,
        NEW.quantity,
        NEW.reference_number,
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_inventory_layer ON public.purchases;
CREATE TRIGGER trigger_create_inventory_layer
    AFTER INSERT ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_layer_on_purchase();

COMMENT ON FUNCTION create_inventory_layer_on_purchase() IS '입고 시 재고 레이어 자동 생성';


-- ============================================
-- 6. 권한 부여
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_layers TO authenticated;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ purchases, sales, inventory_layers 테이블 생성 완료';
    RAISE NOTICE '✅ 인덱스 생성 완료';
    RAISE NOTICE '✅ 트리거 생성 완료 (입고 시 재고 레이어 자동 생성)';
    RAISE NOTICE '✅ RLS 비활성화 완료 (앱 레벨 권한 관리)';
END $$;



-- ======================================
-- File: clients_rpc_functions.sql
-- ======================================

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



-- ======================================
-- File: products_rpc_functions.sql
-- ======================================

-- ============================================
-- 품목 관리 RPC 함수 생성
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_products_list();

-- 품목 목록 조회 함수 (RLS 우회)
CREATE OR REPLACE FUNCTION get_products_list()
RETURNS TABLE (
    id UUID,
    code VARCHAR(50),
    name VARCHAR(100),
    category VARCHAR(50),
    unit VARCHAR(20),
    specification TEXT,
    manufacturer VARCHAR(100),
    barcode VARCHAR(100),
    min_stock_level INTEGER,
    standard_purchase_price NUMERIC(15,2),
    standard_sale_price NUMERIC(15,2),
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
        p.id,
        p.code,
        p.name,
        p.category,
        p.unit,
        p.specification,
        p.manufacturer,
        p.barcode,
        p.min_stock_level,
        p.standard_purchase_price,
        p.standard_sale_price,
        p.is_active,
        p.created_at,
        p.updated_at
    FROM public.products p
    ORDER BY p.code ASC;
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION get_products_list() TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION get_products_list() IS '모든 품목 목록 조회 (RLS 우회)';

-- ============================================
-- 테스트 쿼리
-- ============================================

-- 함수 실행 테스트
SELECT * FROM get_products_list();



-- ======================================
-- File: users_rpc_functions.sql
-- ======================================

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



-- ======================================
-- File: purchases_sales_rpc_functions.sql
-- ======================================

-- =====================================================
-- 입고/판매 내역 조회 RPC 함수
-- =====================================================

-- 입고 내역 조회 함수
CREATE OR REPLACE FUNCTION get_purchases_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  client_id TEXT,
  client_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  purchase_date DATE,
  quantity NUMERIC,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.branch_id,
    b.name AS branch_name,
    p.client_id,
    c.name AS client_name,
    p.product_id,
    pr.code AS product_code,
    pr.name AS product_name,
    pr.unit,
    p.purchase_date,
    p.quantity,
    p.unit_cost,
    p.total_cost,
    p.reference_number,
    p.notes,
    p.created_at,
    p.created_by
  FROM purchases p
  INNER JOIN branches b ON p.branch_id = b.id
  INNER JOIN clients c ON p.client_id = c.id
  INNER JOIN products pr ON p.product_id = pr.id
  WHERE 
    (get_purchases_list.p_branch_id IS NULL OR p.branch_id = get_purchases_list.p_branch_id)
    AND (get_purchases_list.p_start_date IS NULL OR p.purchase_date >= get_purchases_list.p_start_date)
    AND (get_purchases_list.p_end_date IS NULL OR p.purchase_date <= get_purchases_list.p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;

-- 판매 내역 조회 함수
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  branch_id TEXT,
  branch_name TEXT,
  client_id TEXT,
  customer_name TEXT,
  product_id TEXT,
  product_code TEXT,
  product_name TEXT,
  unit TEXT,
  sale_date DATE,
  quantity NUMERIC,
  unit_price NUMERIC,
  total_amount NUMERIC,
  cost_of_goods NUMERIC,
  profit NUMERIC,
  profit_margin NUMERIC,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  created_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.branch_id,
    b.name AS branch_name,
    s.client_id,
    c.name AS customer_name,
    s.product_id,
    pr.code AS product_code,
    pr.name AS product_name,
    pr.unit,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.total_amount,
    s.cost_of_goods,
    s.profit,
    s.profit_margin,
    s.reference_number,
    s.notes,
    s.created_at,
    s.created_by
  FROM sales s
  INNER JOIN branches b ON s.branch_id = b.id
  INNER JOIN clients c ON s.client_id = c.id
  INNER JOIN products pr ON s.product_id = pr.id
  WHERE 
    (get_sales_list.p_branch_id IS NULL OR s.branch_id = get_sales_list.p_branch_id)
    AND (get_sales_list.p_start_date IS NULL OR s.sale_date >= get_sales_list.p_start_date)
    AND (get_sales_list.p_end_date IS NULL OR s.sale_date <= get_sales_list.p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_purchases_list(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_list(TEXT, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_purchases_list(TEXT, DATE, DATE) IS '입고 내역 조회 - 지점, 기간 필터링 가능';
COMMENT ON FUNCTION get_sales_list(TEXT, DATE, DATE) IS '판매 내역 조회 - 지점, 기간 필터링 가능';



