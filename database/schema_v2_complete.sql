-- =====================================================
-- Drevers ERP 통합 스키마 v2.0
-- 작성일: 2025-12-05
-- 설명: 현재 운영 DB 상태와 동기화된 최신 스키마
-- =====================================================

-- ============================================
-- 0. 전제조건: 이미 존재하는 테이블
--    - users, branches (기존 생성됨)
-- ============================================


-- ============================================
-- 1. sessions 테이블 (세션 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON public.sessions(is_valid);

COMMENT ON TABLE public.sessions IS '사용자 세션 정보';


-- ============================================
-- 2. clients 테이블 (거래처)
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.clients(is_active);

COMMENT ON TABLE public.clients IS '거래처 정보 (공급업체/고객)';
COMMENT ON COLUMN public.clients.type IS '거래처 유형 (supplier: 공급업체, customer: 고객, both: 둘 다)';


-- ============================================
-- 3. products 테이블 (품목)
-- ============================================
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
    standard_purchase_price NUMERIC(15, 2),  -- 표준 입고 단가
    standard_sale_price NUMERIC(15, 2),       -- 표준 판매 단가
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

COMMENT ON TABLE public.products IS '품목 정보';
COMMENT ON COLUMN public.products.standard_purchase_price IS '표준 입고 단가';
COMMENT ON COLUMN public.products.standard_sale_price IS '표준 판매 단가';


-- ============================================
-- 4. purchases 테이블 (입고)
-- ✅ 2025-12-05: VAT 컬럼 추가 완료
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,  -- 공급업체 필수
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),      -- 입고 단가
    supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0,                 -- 공급가
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,                   -- 부가세
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,                  -- 합계 (공급가 + 부가세)
    total_cost NUMERIC(15, 2),                                       -- 기존 호환성 유지
    reference_number VARCHAR(50),                                    -- 거래번호
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON public.purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_client_id ON public.purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON public.purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_reference_number ON public.purchases(reference_number);

COMMENT ON TABLE public.purchases IS '입고 내역';
COMMENT ON COLUMN public.purchases.supply_price IS '공급가 (부가세 별도)';
COMMENT ON COLUMN public.purchases.tax_amount IS '부가세';
COMMENT ON COLUMN public.purchases.total_price IS '합계 (공급가 + 부가세)';


-- ============================================
-- 5. sales 테이블 (판매)
-- ✅ 2025-12-05: VAT 컬럼 추가 완료
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,  -- 고객 선택 (NULL 허용)
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),     -- 판매 단가
    supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0,                  -- 공급가
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,                    -- 부가세
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0,                   -- 합계 (공급가 + 부가세)
    unit_cogs NUMERIC(15, 2),                                         -- 단위 원가
    total_cogs NUMERIC(15, 2),                                        -- 총 원가
    cost_of_goods_sold NUMERIC(15, 2),                               -- FIFO 매출원가
    profit NUMERIC(15, 2),                                            -- 이익
    reference_number VARCHAR(50),                                     -- 거래번호
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_reference_number ON public.sales(reference_number);

COMMENT ON TABLE public.sales IS '판매 내역';
COMMENT ON COLUMN public.sales.client_id IS '고객 ID (선택, NULL 허용)';
COMMENT ON COLUMN public.sales.supply_price IS '공급가 (부가세 별도)';
COMMENT ON COLUMN public.sales.tax_amount IS '부가세';
COMMENT ON COLUMN public.sales.total_price IS '합계 (공급가 + 부가세)';
COMMENT ON COLUMN public.sales.cost_of_goods_sold IS 'FIFO 매출원가';
COMMENT ON COLUMN public.sales.profit IS '이익 (total_price - cost_of_goods_sold)';


-- ============================================
-- 6. inventory_layers 테이블 (FIFO 재고 레이어)
-- ✅ 2025-12-05: source_type, source_id 컬럼 추가 (재고 조정용)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    original_quantity INTEGER NOT NULL,                              -- 최초 수량
    remaining_quantity INTEGER NOT NULL,                             -- 남은 수량 (마이너스 가능)
    source_type TEXT DEFAULT 'PURCHASE',                             -- 'PURCHASE' | 'ADJUSTMENT'
    source_id UUID,                                                   -- 원본 ID (purchase_id 또는 adjustment_id)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_layers_branch_product ON public.inventory_layers(branch_id, product_id, purchase_date ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_layers_remaining ON public.inventory_layers(remaining_quantity) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_layers_purchase_id ON public.inventory_layers(purchase_id);
CREATE INDEX IF NOT EXISTS idx_inventory_layers_source ON public.inventory_layers(source_type, source_id);

COMMENT ON TABLE public.inventory_layers IS 'FIFO 재고 레이어';
COMMENT ON COLUMN public.inventory_layers.source_type IS '레이어 생성 원본 (PURCHASE: 입고, ADJUSTMENT: 재고조정)';
COMMENT ON COLUMN public.inventory_layers.source_id IS '원본 레코드 ID';


-- ============================================
-- 7. inventory_adjustments 테이블 (재고 조정)
-- Phase 5에서 추가됨
-- ✅ 2025-12-05: 실제 DB 구조에 맞게 수정
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('INCREASE', 'DECREASE')),
    adjustment_reason TEXT NOT NULL,                     -- 조정 사유 (실사, 불량, 분실, 반품, 기타)
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,                                  -- 단위
    unit_cost NUMERIC,                                   -- 단가 (nullable)
    supply_price NUMERIC,                                -- 공급가
    tax_amount NUMERIC,                                  -- 부가세
    total_cost NUMERIC,                                  -- 합계
    adjustment_date DATE NOT NULL,                       -- 조정일
    notes TEXT,
    reference_number TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_cancelled BOOLEAN NOT NULL DEFAULT false,         -- 취소 여부
    cancelled_by UUID REFERENCES public.users(id),
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_branch ON public.inventory_adjustments(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON public.inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date ON public.inventory_adjustments(adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created_at ON public.inventory_adjustments(created_at DESC);

COMMENT ON TABLE public.inventory_adjustments IS '재고 조정 내역';
COMMENT ON COLUMN public.inventory_adjustments.adjustment_type IS '조정 유형 (INCREASE: 증가, DECREASE: 감소)';
COMMENT ON COLUMN public.inventory_adjustments.adjustment_reason IS '조정 사유 (실사, 불량, 분실, 반품, 기타)';
COMMENT ON COLUMN public.inventory_adjustments.is_cancelled IS '취소 여부';


-- ============================================
-- 8. audit_logs 테이블 (감사 로그)
-- Phase 3에서 추가됨
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,                                         -- 대상 테이블
    record_id UUID NOT NULL,                                          -- 대상 레코드 ID
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_fields JSONB,                                             -- 변경된 필드들
    old_values JSONB,                                                  -- 이전 값
    new_values JSONB,                                                  -- 새 값
    user_id UUID REFERENCES public.users(id),
    user_name TEXT,
    branch_id UUID REFERENCES public.branches(id),
    branch_name TEXT,
    product_name TEXT,                                                 -- 품목명 (편의용)
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS '데이터 변경 감사 로그';


-- ============================================
-- 9. RLS (Row Level Security) 비활성화
-- 앱 레벨에서 권한 관리 (Server Actions)
-- ============================================
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_layers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;


-- ============================================
-- 10. 트리거: 입고 시 재고 레이어 자동 생성
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


-- ============================================
-- 11. 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
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
-- 12. 권한 부여
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_layers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_adjustments TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;


-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✅ Drevers ERP 통합 스키마 v2.0 적용 완료';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '생성된 테이블:';
    RAISE NOTICE '  - sessions (세션)';
    RAISE NOTICE '  - clients (거래처)';
    RAISE NOTICE '  - products (품목)';
    RAISE NOTICE '  - purchases (입고) + VAT 컬럼';
    RAISE NOTICE '  - sales (판매) + VAT 컬럼';
    RAISE NOTICE '  - inventory_layers (FIFO 재고)';
    RAISE NOTICE '  - inventory_adjustments (재고 조정)';
    RAISE NOTICE '  - audit_logs (감사 로그)';
    RAISE NOTICE '=====================================================';
END $$;

