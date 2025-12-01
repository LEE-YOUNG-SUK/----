-- =====================================================
-- Phase 5-1: inventory_adjustments 테이블 생성
-- =====================================================
-- 목적: 입고/판매 외의 재고 변동을 기록하는 재고 조정 시스템
-- 권한: 매니저 이상 (0000~0002)
-- Audit Log: RPC 함수에서 직접 INSERT (트리거 사용 안 함)

-- =====================================================
-- 1. inventory_adjustments 테이블 생성
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 관련 엔티티
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  -- 조정 정보
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('INCREASE', 'DECREASE')),
  adjustment_reason TEXT NOT NULL CHECK (adjustment_reason IN ('STOCK_COUNT', 'DAMAGE', 'LOSS', 'RETURN', 'OTHER')),
  
  -- 수량 정보
  quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  
  -- 원가 정보 (INCREASE 시 필수)
  unit_cost NUMERIC(15, 2) CHECK (unit_cost >= 0),
  supply_price NUMERIC(15, 2) CHECK (supply_price >= 0),
  tax_amount NUMERIC(15, 2) CHECK (tax_amount >= 0),
  total_cost NUMERIC(15, 2) CHECK (total_cost >= 0),
  
  -- 메타 정보
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  reference_number TEXT,
  
  -- 감사 정보
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 취소 정보 (원장 이상만 가능)
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
);

-- =====================================================
-- 2. 인덱스 생성
-- =====================================================

-- 기본 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_branch 
  ON public.inventory_adjustments(branch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product 
  ON public.inventory_adjustments(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date 
  ON public.inventory_adjustments(adjustment_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created 
  ON public.inventory_adjustments(created_at DESC);

-- 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_type 
  ON public.inventory_adjustments(adjustment_type);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_reason 
  ON public.inventory_adjustments(adjustment_reason);

-- 취소 여부 필터
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_active 
  ON public.inventory_adjustments(is_cancelled, adjustment_date DESC) 
  WHERE is_cancelled = FALSE;

-- 복합 인덱스 (지점별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_branch_date 
  ON public.inventory_adjustments(branch_id, adjustment_date DESC);

-- =====================================================
-- 3. 코멘트 (테이블 문서화)
-- =====================================================

COMMENT ON TABLE public.inventory_adjustments IS 
  '재고 조정 내역 (Phase 5) - 입고/판매 외 재고 변동 추적';

COMMENT ON COLUMN public.inventory_adjustments.id IS '조정 ID';
COMMENT ON COLUMN public.inventory_adjustments.branch_id IS '지점 ID';
COMMENT ON COLUMN public.inventory_adjustments.product_id IS '품목 ID';
COMMENT ON COLUMN public.inventory_adjustments.adjustment_type IS '조정 유형: INCREASE(증가), DECREASE(감소)';
COMMENT ON COLUMN public.inventory_adjustments.adjustment_reason IS '조정 사유: STOCK_COUNT(실��), DAMAGE(불량), LOSS(분실), RETURN(반품), OTHER(기타)';
COMMENT ON COLUMN public.inventory_adjustments.quantity IS '조정 수량 (항상 양수)';
COMMENT ON COLUMN public.inventory_adjustments.unit IS '단위';
COMMENT ON COLUMN public.inventory_adjustments.unit_cost IS '단위 원가 (INCREASE 시 필수)';
COMMENT ON COLUMN public.inventory_adjustments.supply_price IS '공급가 (부가세 제외)';
COMMENT ON COLUMN public.inventory_adjustments.tax_amount IS '부가세';
COMMENT ON COLUMN public.inventory_adjustments.total_cost IS '총 원가 (quantity * unit_cost)';
COMMENT ON COLUMN public.inventory_adjustments.adjustment_date IS '조정일자';
COMMENT ON COLUMN public.inventory_adjustments.notes IS '비고';
COMMENT ON COLUMN public.inventory_adjustments.reference_number IS '참조 번호 (외부 문서)';
COMMENT ON COLUMN public.inventory_adjustments.created_by IS '작성자 ID';
COMMENT ON COLUMN public.inventory_adjustments.created_at IS '작성 일시';
COMMENT ON COLUMN public.inventory_adjustments.is_cancelled IS '취소 여부';
COMMENT ON COLUMN public.inventory_adjustments.cancelled_by IS '취소자 ID';
COMMENT ON COLUMN public.inventory_adjustments.cancelled_at IS '취소 일시';
COMMENT ON COLUMN public.inventory_adjustments.cancel_reason IS '취소 사유';

-- =====================================================
-- 4. 기존 inventory_layers 테이블 확장 (source_type 추가)
-- =====================================================

-- inventory_layers에 source_type 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
  -- source_type 컬럼 추가 (PURCHASE, SALE, ADJUSTMENT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='inventory_layers' AND column_name='source_type'
  ) THEN
    ALTER TABLE public.inventory_layers 
    ADD COLUMN source_type TEXT DEFAULT 'PURCHASE' CHECK (source_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT'));
    
    COMMENT ON COLUMN public.inventory_layers.source_type IS '재고 출처: PURCHASE(입고), SALE(판매 반품), ADJUSTMENT(조정)';
  END IF;

  -- source_id 컬럼 추가 (범용 참조 ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='inventory_layers' AND column_name='source_id'
  ) THEN
    ALTER TABLE public.inventory_layers 
    ADD COLUMN source_id UUID;
    
    COMMENT ON COLUMN public.inventory_layers.source_id IS '출처 레코드 ID (purchase_id, sale_id, adjustment_id 등)';
  END IF;
END $$;

-- source_type 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_inventory_layers_source_type 
  ON public.inventory_layers(source_type);

CREATE INDEX IF NOT EXISTS idx_inventory_layers_source_id 
  ON public.inventory_layers(source_id);

-- =====================================================
-- 5. 검증 쿼리
-- =====================================================

-- 테이블 생성 확인
SELECT 
  'inventory_adjustments' AS table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name = 'inventory_adjustments' AND table_schema = 'public';

-- 인덱스 생성 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'inventory_adjustments'
ORDER BY indexname;

-- inventory_layers 확장 확인
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'inventory_layers' 
  AND table_schema = 'public'
  AND column_name IN ('source_type', 'source_id')
ORDER BY ordinal_position;

-- =====================================================
-- Phase 5-1 완료 메시지
-- =====================================================
SELECT 
  '✅ Phase 5-1 완료: inventory_adjustments 테이블 생성' AS status,
  'inventory_layers 확장 (source_type, source_id)' AS enhancement,
  '트리거 없음 - RPC 함수에서 audit_logs 직접 INSERT' AS audit_strategy,
  '다음: Phase 5-2 RPC 함수 구현' AS next_step;
