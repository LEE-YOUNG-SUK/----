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

-- purchases 테이블에 누락된 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='created_by') THEN
        ALTER TABLE public.purchases ADD COLUMN created_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='updated_at') THEN
        ALTER TABLE public.purchases ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='updated_by') THEN
        ALTER TABLE public.purchases ADD COLUMN updated_by TEXT;
    END IF;
END $$;

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
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

-- sales 테이블에 누락된 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='cost_of_goods_sold') THEN
        ALTER TABLE public.sales ADD COLUMN cost_of_goods_sold NUMERIC(15, 2);
        RAISE NOTICE '✅ sales 테이블에 cost_of_goods_sold 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='profit') THEN
        ALTER TABLE public.sales ADD COLUMN profit NUMERIC(15, 2);
        RAISE NOTICE '✅ sales 테이블에 profit 컬럼 추가 완료';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='updated_at') THEN
        ALTER TABLE public.sales ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='updated_by') THEN
        ALTER TABLE public.sales ADD COLUMN updated_by TEXT;
    END IF;
END $$;

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
