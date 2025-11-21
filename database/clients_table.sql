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
