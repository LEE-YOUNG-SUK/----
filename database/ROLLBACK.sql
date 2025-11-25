-- =====================================================
-- 롤백 스크립트 (문제 발생 시 실행)
-- =====================================================

-- ============================================
-- 1. 제약 조건 롤백
-- ============================================

-- purchases NOT NULL 제거
ALTER TABLE purchases ALTER COLUMN supply_price DROP NOT NULL;
ALTER TABLE purchases ALTER COLUMN tax_amount DROP NOT NULL;
ALTER TABLE purchases ALTER COLUMN total_price DROP NOT NULL;

-- sales NOT NULL 제거
ALTER TABLE sales ALTER COLUMN supply_price DROP NOT NULL;
ALTER TABLE sales ALTER COLUMN tax_amount DROP NOT NULL;
ALTER TABLE sales ALTER COLUMN total_price DROP NOT NULL;

-- sales.profit NOT NULL 복구
ALTER TABLE sales ALTER COLUMN profit SET NOT NULL;

RAISE NOTICE '✅ 제약 조건 롤백 완료';

-- ============================================
-- 2. 데이터 롤백 (NULL로 복구)
-- ============================================

-- purchases 데이터 NULL로 복구 (선택사항)
-- UPDATE purchases
-- SET 
--   supply_price = NULL,
--   tax_amount = NULL,
--   total_price = NULL
-- WHERE created_at < '2025-01-30';  -- 특정 날짜 이전 데이터만

-- RAISE NOTICE '✅ purchases 데이터 롤백 완료';

-- ============================================
-- 3. 신규 RPC 함수 삭제
-- ============================================

DROP FUNCTION IF EXISTS process_purchase_with_layers(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, date, uuid, character varying, text);
DROP FUNCTION IF EXISTS process_sale_with_fifo(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, date, uuid, character varying, text);

RAISE NOTICE '✅ 신규 RPC 함수 삭제 완료';

-- ============================================
-- 4. 구버전 RPC 함수 복구
-- ============================================

-- 구버전 process_purchase_with_layers (부가세 없음)
CREATE OR REPLACE FUNCTION process_purchase_with_layers(
  p_branch_id UUID,
  p_client_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_purchase_date DATE,
  p_created_by UUID,
  p_reference_number VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, purchase_id UUID) AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  INSERT INTO purchases (
    branch_id, client_id, product_id, purchase_date,
    quantity, unit_cost, reference_number, notes, created_by
  ) VALUES (
    p_branch_id, p_client_id, p_product_id, p_purchase_date,
    p_quantity, p_unit_cost, p_reference_number, p_notes, p_created_by
  ) RETURNING id INTO v_purchase_id;

  RETURN QUERY SELECT TRUE, '입고 저장 성공'::TEXT, v_purchase_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, '입고 저장 실패: ' || SQLERRM, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 구버전 process_sale_with_fifo (부가세 없음)
CREATE OR REPLACE FUNCTION process_sale_with_fifo(
  p_branch_id UUID,
  p_client_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_sale_date DATE,
  p_created_by UUID,
  p_reference_number VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, sale_id UUID) AS $$
DECLARE
  v_sale_id UUID;
  v_total_cost NUMERIC := 0;
BEGIN
  -- 간단한 버전 (FIFO 생략)
  INSERT INTO sales (
    branch_id, client_id, product_id, sale_date,
    quantity, unit_price, reference_number, notes, created_by
  ) VALUES (
    p_branch_id, p_client_id, p_product_id, p_sale_date,
    p_quantity, p_unit_price, p_reference_number, p_notes, p_created_by
  ) RETURNING id INTO v_sale_id;

  RETURN QUERY SELECT TRUE, '판매 저장 성공'::TEXT, v_sale_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, '판매 저장 실패: ' || SQLERRM, NULL::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE '✅ 구버전 RPC 함수 복구 완료';

-- ============================================
-- 5. 트리거 원복
-- ============================================

-- calculate_total_cost 원복 (quantity × unit_cost로 재계산)
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_cost := NEW.quantity * NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE '✅ 트리거 원복 완료';

-- ============================================
-- 완료 메시지
-- ============================================

RAISE NOTICE '==================================================';
RAISE NOTICE '✅ 롤백 완료';
RAISE NOTICE '==================================================';
RAISE NOTICE '다음 단계: Server Actions도 원복 필요';
RAISE NOTICE '파일: app/purchases/actions.ts, app/sales/actions.ts';
RAISE NOTICE '==================================================';
