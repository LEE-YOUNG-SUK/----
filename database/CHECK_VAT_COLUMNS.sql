-- =====================================================
-- 공급가/부가세/합계 컬럼 확인 스크립트
-- =====================================================

-- 1️⃣ purchases 테이블 컬럼 확인
SELECT 
    '1. purchases 테이블 컬럼 구조' AS 검사항목,
    column_name AS 컬럼명,
    data_type AS 데이터타입,
    is_nullable AS NULL허용,
    column_default AS 기본값
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'purchases'
  AND column_name IN ('supply_price', 'tax_amount', 'total_price', 'total_cost', 'unit_cost', 'quantity')
ORDER BY 
    CASE column_name
        WHEN 'quantity' THEN 1
        WHEN 'unit_cost' THEN 2
        WHEN 'supply_price' THEN 3
        WHEN 'tax_amount' THEN 4
        WHEN 'total_price' THEN 5
        WHEN 'total_cost' THEN 6
    END;

-- 2️⃣ sales 테이블 컬럼 확인
SELECT 
    '2. sales 테이블 컬럼 구조' AS 검사항목,
    column_name AS 컬럼명,
    data_type AS 데이터타입,
    is_nullable AS NULL허용,
    column_default AS 기본값
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sales'
  AND column_name IN ('supply_price', 'tax_amount', 'total_price', 'unit_price', 'quantity', 'cost_of_goods_sold', 'profit')
ORDER BY 
    CASE column_name
        WHEN 'quantity' THEN 1
        WHEN 'unit_price' THEN 2
        WHEN 'supply_price' THEN 3
        WHEN 'tax_amount' THEN 4
        WHEN 'total_price' THEN 5
        WHEN 'cost_of_goods_sold' THEN 6
        WHEN 'profit' THEN 7
    END;

-- 3️⃣ inventory_layers 테이블 컬럼 확인
SELECT 
    '3. inventory_layers 테이블 컬럼 구조' AS 검사항목,
    column_name AS 컬럼명,
    data_type AS 데이터타입,
    is_nullable AS NULL허용
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'inventory_layers'
  AND column_name IN ('unit_cost', 'original_quantity', 'remaining_quantity')
ORDER BY column_name;

-- 4️⃣ process_purchase_with_layers 함수 파라미터 확인
SELECT 
    '4. process_purchase_with_layers 함수 파라미터' AS 검사항목,
    p.parameter_name AS 파라미터명,
    p.data_type AS 데이터타입,
    p.parameter_mode AS 모드,
    p.parameter_default AS 기본값
FROM information_schema.parameters p
WHERE p.specific_schema = 'public'
  AND p.specific_name IN (
    SELECT r.specific_name 
    FROM information_schema.routines r 
    WHERE r.routine_name = 'process_purchase_with_layers'
  )
  AND p.parameter_name IN ('p_supply_price', 'p_tax_amount', 'p_total_price', 'p_unit_cost', 'p_quantity')
ORDER BY p.ordinal_position;

-- 5️⃣ process_sale_with_fifo 함수 파라미터 확인
SELECT 
    '5. process_sale_with_fifo 함수 파라미터' AS 검사항목,
    p.parameter_name AS 파라미터명,
    p.data_type AS 데이터타입,
    p.parameter_mode AS 모드,
    p.parameter_default AS 기본값
FROM information_schema.parameters p
WHERE p.specific_schema = 'public'
  AND p.specific_name IN (
    SELECT r.specific_name 
    FROM information_schema.routines r 
    WHERE r.routine_name = 'process_sale_with_fifo'
  )
  AND p.parameter_name IN ('p_supply_price', 'p_tax_amount', 'p_total_price', 'p_unit_price', 'p_quantity')
ORDER BY p.ordinal_position;

-- 6️⃣ purchases 테이블 최근 데이터 샘플 (공급가/부가세/합계 값 확인)
SELECT 
    '6. purchases 최근 데이터 샘플' AS 검사항목,
    id,
    purchase_date AS 입고일,
    quantity AS 수량,
    unit_cost AS 단가,
    supply_price AS 공급가,
    tax_amount AS 부가세,
    total_price AS 합계,
    total_cost AS 합계구버전,
    created_at AS 생성일시
FROM purchases
ORDER BY created_at DESC
LIMIT 5;

-- 7️⃣ sales 테이블 최근 데이터 샘플 (공급가/부가세/합계 값 확인)
SELECT 
    '7. sales 최근 데이터 샘플' AS 검사항목,
    id,
    sale_date AS 판매일,
    quantity AS 수량,
    unit_price AS 단가,
    supply_price AS 공급가,
    tax_amount AS 부가세,
    total_price AS 합계,
    cost_of_goods_sold AS 원가,
    profit AS 이익,
    created_at AS 생성일시
FROM sales
ORDER BY created_at DESC
LIMIT 5;

-- 8️⃣ RPC 함수 존재 여부 확인
SELECT 
    '8. RPC 함수 존재 여부' AS 검사항목,
    routine_name AS 함수명,
    routine_type AS 타입,
    data_type AS 반환타입
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('process_purchase_with_layers', 'process_sale_with_fifo')
ORDER BY routine_name;

-- 9️⃣ process_purchase_with_layers 함수 전체 정의 확인
SELECT 
    '9. process_purchase_with_layers 함수 소스' AS 검사항목,
    pg_get_functiondef(p.oid) AS 함수정의
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'process_purchase_with_layers';

-- 🔟 process_sale_with_fifo 함수 전체 정의 확인
SELECT 
    '10. process_sale_with_fifo 함수 소스' AS 검사항목,
    pg_get_functiondef(p.oid) AS 함수정의
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'process_sale_with_fifo';
