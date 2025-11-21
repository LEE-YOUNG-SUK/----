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
