-- =====================================================
-- Phase 6.5: purchases 테이블 supplier_id NULL 허용
-- 날짜: 2025-12-09
-- 목적: 입고 시 공급업체 선택을 optional로 변경
-- =====================================================

-- purchases.client_id NOT NULL 제약 제거
ALTER TABLE public.purchases 
ALTER COLUMN client_id DROP NOT NULL;

-- 확인 쿼리
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'purchases' 
    AND column_name = 'client_id';

-- 결과 예상: is_nullable = 'YES'

COMMENT ON COLUMN public.purchases.client_id IS '공급업체 ID (NULL 가능 - 공급업체 미지정 입고 허용)';
