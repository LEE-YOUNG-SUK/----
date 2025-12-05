-- =====================================================
-- 입고/판매/재고 레이어 테이블 생성
-- 버전: v2.0 (2025-12-05 업데이트)
-- 변경사항: VAT 컬럼(supply_price, tax_amount, total_price) 추가
-- =====================================================

-- ============================================
-- 1. purchases 테이블 (입고)
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0,    -- 공급가
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,      -- 부가세
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- 합계 (공급가 + 부가세)
    total_cost NUMERIC(15, 2),                          -- 기존 호환성 유지
    reference_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by TEXT
);

-- VAT 컬럼이 없으면 추가 (마이그레이션용)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='supply_price') THEN
        ALTER TABLE public.purchases ADD COLUMN supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ purchases.supply_price 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='tax_amount') THEN
        ALTER TABLE public.purchases ADD COLUMN tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ purchases.tax_amount 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='total_price') THEN
        ALTER TABLE public.purchases ADD COLUMN total_price NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ purchases.total_price 컬럼 추가 완료';
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_client_id ON public.purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON public.purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_reference_number ON public.purchases(reference_number);

-- 코멘트
COMMENT ON TABLE public.purchases IS '입고 내역';
COMMENT ON COLUMN public.purchases.id IS '입고 ID (UUID)';
COMMENT ON COLUMN public.purchases.branch_id IS '지점 ID';
COMMENT ON COLUMN public.purchases.client_id IS '공급업체 ID';
COMMENT ON COLUMN public.purchases.product_id IS '품목 ID';
COMMENT ON COLUMN public.purchases.purchase_date IS '입고일';
COMMENT ON COLUMN public.purchases.quantity IS '입고 수량';
COMMENT ON COLUMN public.purchases.unit_cost IS '입고 단가';
COMMENT ON COLUMN public.purchases.supply_price IS '공급가 (부가세 별도)';
COMMENT ON COLUMN public.purchases.tax_amount IS '부가세';
COMMENT ON COLUMN public.purchases.total_price IS '합계 (공급가 + 부가세)';
COMMENT ON COLUMN public.purchases.total_cost IS '총 입고액 (기존 호환)';
COMMENT ON COLUMN public.purchases.reference_number IS '거래번호';
COMMENT ON COLUMN public.purchases.notes IS '비고';


-- ============================================
-- 2. sales 테이블 (판매)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,  -- NULL 허용 (고객 선택)
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0,    -- 공급가
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,      -- 부가세
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- 합계 (공급가 + 부가세)
    unit_cogs NUMERIC(15, 2),                           -- 단위 원가
    total_cogs NUMERIC(15, 2),                          -- 총 원가
    cost_of_goods_sold NUMERIC(15, 2),                  -- FIFO 매출원가
    profit NUMERIC(15, 2),                              -- 이익
    reference_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by TEXT
);

-- VAT 컬럼이 없으면 추가 (마이그레이션용)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='supply_price') THEN
        ALTER TABLE public.sales ADD COLUMN supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ sales.supply_price 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='tax_amount') THEN
        ALTER TABLE public.sales ADD COLUMN tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ sales.tax_amount 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='total_price') THEN
        ALTER TABLE public.sales ADD COLUMN total_price NUMERIC(15, 2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ sales.total_price 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='cost_of_goods_sold') THEN
        ALTER TABLE public.sales ADD COLUMN cost_of_goods_sold NUMERIC(15, 2);
        RAISE NOTICE '✅ sales.cost_of_goods_sold 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='profit') THEN
        ALTER TABLE public.sales ADD COLUMN profit NUMERIC(15, 2);
        RAISE NOTICE '✅ sales.profit 컬럼 추가 완료';
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_reference_number ON public.sales(reference_number);

-- 코멘트
COMMENT ON TABLE public.sales IS '판매 내역';
COMMENT ON COLUMN public.sales.id IS '판매 ID (UUID)';
COMMENT ON COLUMN public.sales.branch_id IS '지점 ID';
COMMENT ON COLUMN public.sales.client_id IS '고객 ID (선택, NULL 허용)';
COMMENT ON COLUMN public.sales.product_id IS '품목 ID';
COMMENT ON COLUMN public.sales.sale_date IS '판매일';
COMMENT ON COLUMN public.sales.quantity IS '판매 수량';
COMMENT ON COLUMN public.sales.unit_price IS '판매 단가';
COMMENT ON COLUMN public.sales.supply_price IS '공급가 (부가세 별도)';
COMMENT ON COLUMN public.sales.tax_amount IS '부가세';
COMMENT ON COLUMN public.sales.total_price IS '합계 (공급가 + 부가세)';
COMMENT ON COLUMN public.sales.cost_of_goods_sold IS 'FIFO 매출원가';
COMMENT ON COLUMN public.sales.profit IS '이익 (total_price - cost_of_goods_sold)';


-- ============================================
-- 3. inventory_layers 테이블 (FIFO 재고 레이어)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    original_quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,              -- 마이너스 허용 (음수 재고)
    source_type TEXT DEFAULT 'PURCHASE',              -- 'PURCHASE' | 'ADJUSTMENT'
    source_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- source_type, source_id 컬럼 추가 (마이그레이션용)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_layers' AND column_name='source_type') THEN
        ALTER TABLE public.inventory_layers ADD COLUMN source_type TEXT DEFAULT 'PURCHASE';
        RAISE NOTICE '✅ inventory_layers.source_type 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_layers' AND column_name='source_id') THEN
        ALTER TABLE public.inventory_layers ADD COLUMN source_id UUID;
        RAISE NOTICE '✅ inventory_layers.source_id 컬럼 추가 완료';
    END IF;
END $$;

-- 인덱스 생성 (FIFO 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_inventory_layers_branch_product ON public.inventory_layers(branch_id, product_id, purchase_date ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_layers_remaining ON public.inventory_layers(remaining_quantity) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_layers_purchase_id ON public.inventory_layers(purchase_id);
CREATE INDEX IF NOT EXISTS idx_inventory_layers_source ON public.inventory_layers(source_type, source_id);

-- 코멘트
COMMENT ON TABLE public.inventory_layers IS 'FIFO 재고 레이어';
COMMENT ON COLUMN public.inventory_layers.id IS '레이어 ID (UUID)';
COMMENT ON COLUMN public.inventory_layers.branch_id IS '지점 ID';
COMMENT ON COLUMN public.inventory_layers.product_id IS '품목 ID';
COMMENT ON COLUMN public.inventory_layers.purchase_id IS '입고 ID (참조)';
COMMENT ON COLUMN public.inventory_layers.purchase_date IS '입고일 (FIFO 정렬용)';
COMMENT ON COLUMN public.inventory_layers.unit_cost IS '단위 원가';
COMMENT ON COLUMN public.inventory_layers.original_quantity IS '최초 수량';
COMMENT ON COLUMN public.inventory_layers.remaining_quantity IS '남은 수량 (마이너스 허용)';
COMMENT ON COLUMN public.inventory_layers.source_type IS '레이어 원본 (PURCHASE: 입고, ADJUSTMENT: 재고조정)';
COMMENT ON COLUMN public.inventory_layers.source_id IS '원본 레코드 ID';


-- ============================================
-- 4. RLS 비활성화 (앱 레벨 권한 관리)
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
        source_type,
        source_id,
        created_at
    ) VALUES (
        NEW.branch_id,
        NEW.product_id,
        NEW.id,
        NEW.purchase_date,
        NEW.unit_cost,
        NEW.quantity,
        NEW.quantity,
        'PURCHASE',
        NEW.id,
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
-- 6. 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_purchases_updated_at ON public.purchases;
CREATE TRIGGER update_purchases_updated_at 
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_layers_updated_at ON public.inventory_layers;
CREATE TRIGGER update_inventory_layers_updated_at 
    BEFORE UPDATE ON public.inventory_layers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 7. 권한 부여
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_layers TO authenticated;


-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✅ purchases, sales, inventory_layers 테이블 설정 완료';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '포함된 컬럼:';
    RAISE NOTICE '  - purchases: supply_price, tax_amount, total_price';
    RAISE NOTICE '  - sales: supply_price, tax_amount, total_price, cost_of_goods_sold, profit';
    RAISE NOTICE '  - inventory_layers: source_type, source_id';
    RAISE NOTICE '=====================================================';
END $$;
