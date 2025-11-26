-- =====================================================
-- 참조번호(reference_number)와 비고(notes) 필드 확인
-- =====================================================

-- 1. 테이블 구조 확인 (컬럼 존재 여부)
SELECT 
    '입고(purchases)' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchases' 
  AND column_name IN ('reference_number', 'notes')
UNION ALL
SELECT 
    '판매(sales)' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales' 
  AND column_name IN ('reference_number', 'notes');

-- 2. 입고 테이블 - 참조번호/비고 데이터 확인
SELECT 
    '입고 테이블' as 구분,
    COUNT(*) as 전체_건수,
    COUNT(reference_number) as 참조번호_입력건수,
    COUNT(notes) as 비고_입력건수,
    ROUND(COUNT(reference_number)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as 참조번호_입력율,
    ROUND(COUNT(notes)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as 비고_입력율
FROM purchases;

-- 3. 판매 테이블 - 참조번호/비고 데이터 확인
SELECT 
    '판매 테이블' as 구분,
    COUNT(*) as 전체_건수,
    COUNT(reference_number) as 참조번호_입력건수,
    COUNT(notes) as 비고_입력건수,
    ROUND(COUNT(reference_number)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as 참조번호_입력율,
    ROUND(COUNT(notes)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as 비고_입력율
FROM sales;

-- 4. 입고 테이블 - 최근 10건 샘플 데이터 (참조번호/비고 포함)
SELECT 
    id,
    purchase_date as 입고일,
    reference_number as 참조번호,
    notes as 비고,
    created_at as 등록일시
FROM purchases
ORDER BY created_at DESC
LIMIT 10;

-- 5. 판매 테이블 - 최근 10건 샘플 데이터 (참조번호/비고 포함)
SELECT 
    id,
    sale_date as 판매일,
    reference_number as 참조번호,
    notes as 비고,
    created_at as 등록일시
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- 6. 입고 - 참조번호/비고가 입력된 데이터만 조회
SELECT 
    '입고' as 구분,
    purchase_date as 날짜,
    reference_number as 참조번호,
    notes as 비고,
    total_cost as 금액
FROM purchases
WHERE reference_number IS NOT NULL OR notes IS NOT NULL
ORDER BY purchase_date DESC
LIMIT 20;

-- 7. 판매 - 참조번호/비고가 입력된 데이터만 조회
SELECT 
    '판매' as 구분,
    sale_date as 날짜,
    reference_number as 참조번호,
    notes as 비고,
    total_price as 금액
FROM sales
WHERE reference_number IS NOT NULL OR notes IS NOT NULL
ORDER BY sale_date DESC
LIMIT 20;

-- 8. 참조번호 샘플 데이터 (NULL이 아닌 것만)
SELECT 
    '입고' as 구분,
    reference_number,
    COUNT(*) as 건수
FROM purchases
WHERE reference_number IS NOT NULL AND reference_number != ''
GROUP BY reference_number
ORDER BY 건수 DESC
LIMIT 10
UNION ALL
SELECT 
    '판매' as 구분,
    reference_number,
    COUNT(*) as 건수
FROM sales
WHERE reference_number IS NOT NULL AND reference_number != ''
GROUP BY reference_number
ORDER BY 건수 DESC
LIMIT 10;
