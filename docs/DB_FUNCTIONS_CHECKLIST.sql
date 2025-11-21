-- ============================================
-- 거래처/품목/사용자 관리에 필요한 DB 함수 목록
-- ============================================

-- 이 파일은 Supabase에 생성해야 하는 RPC 함수들의 목록입니다.
-- 기존 바닐라 JS 코드에서 사용하던 함수들을 Next.js 시스템에서도 사용합니다.

-- ============================================
-- 1. 거래처 관리 함수
-- ============================================

-- create_client: 거래처 생성
-- 파라미터: p_code, p_name, p_type, p_contact_person, p_phone, p_email, p_address, p_tax_id, p_notes, p_created_by
-- 반환: success (boolean), message (text)

-- update_client: 거래처 수정
-- 파라미터: p_client_id, p_name, p_type, p_contact_person, p_phone, p_email, p_address, p_tax_id, p_notes, p_is_active
-- 반환: success (boolean), message (text)

-- delete_client: 거래처 삭제
-- 파라미터: p_client_id
-- 반환: success (boolean), message (text)

-- ============================================
-- 2. 품목 관리 함수
-- ============================================

-- create_product: 품목 생성
-- 파라미터: p_code, p_name, p_category, p_unit, p_specification, p_manufacturer, p_barcode, p_min_stock_level, p_standard_purchase_price, p_standard_sale_price, p_created_by
-- 반환: success (boolean), message (text)

-- update_product: 품목 수정
-- 파라미터: p_product_id, p_name, p_category, p_unit, p_specification, p_manufacturer, p_barcode, p_min_stock_level, p_standard_purchase_price, p_standard_sale_price, p_is_active
-- 반환: success (boolean), message (text)

-- delete_product: 품목 삭제
-- 파라미터: p_product_id
-- 반환: success (boolean), message (text)

-- ============================================
-- 3. 사용자 관리 함수
-- ============================================

-- create_user: 사용자 생성
-- 파라미터: p_username, p_password, p_display_name, p_role, p_branch_id, p_created_by
-- 반환: success (boolean), message (text)

-- update_user: 사용자 수정
-- 파라미터: p_user_id, p_display_name, p_role, p_branch_id, p_is_active
-- 반환: success (boolean), message (text)

-- update_user_password: 비밀번호 변경
-- 파라미터: p_user_id, p_new_password
-- 반환: success (boolean), message (text)

-- delete_user: 사용자 삭제
-- 파라미터: p_user_id
-- 반환: success (boolean), message (text)

-- ============================================
-- 확인 방법
-- ============================================

-- Supabase SQL Editor에서 다음 쿼리로 함수 존재 여부 확인:

SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as parameters
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'create_client', 'update_client', 'delete_client',
    'create_product', 'update_product', 'delete_product',
    'create_user', 'update_user', 'update_user_password', 'delete_user'
  )
ORDER BY proname;

-- ============================================
-- 테이블 컬럼 확인
-- ============================================

-- clients 테이블
-- 필수: id, code, name, type, is_active, created_at, updated_at
-- 선택: contact_person, phone, email, address, tax_id, notes

-- products 테이블
-- 필수: id, code, name, unit, is_active, created_at, updated_at
-- 선택: category, specification, manufacturer, barcode, min_stock_level, standard_purchase_price, standard_sale_price

-- users 테이블
-- 필수: id, username, password_hash, display_name, role, is_active, created_at, updated_at
-- 선택: branch_id, last_login_at

-- ============================================
-- notes 컬럼 추가 (clients 테이블)
-- ============================================

-- clients 테이블에 notes 컬럼이 없다면 추가:
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
