-- =====================================================
-- Phase 5 & 6 통합 테스트 체크리스트
-- 실행 방법: Supabase SQL Editor에서 각 쿼리 실행
-- =====================================================


-- =====================================================
-- 📊 PART 1: 데이터 현황 확인
-- =====================================================

-- 1-1. 전체 테이블 레코드 수
SELECT '전체 데이터 현황' AS "검사항목";
SELECT 
    (SELECT COUNT(*) FROM purchases) AS "입고건수",
    (SELECT COUNT(*) FROM sales) AS "판매건수",
    (SELECT COUNT(*) FROM inventory_layers) AS "재고레이어수",
    (SELECT COUNT(*) FROM inventory_adjustments) AS "재고조정건수",
    (SELECT COUNT(*) FROM audit_logs) AS "감사로그수";

-- 1-2. 최근 거래 확인
SELECT '최근 입고 5건' AS "검사항목";
SELECT 
    p.id::TEXT AS id,
    pr.name AS "품목명",
    p.quantity AS "수량",
    p.unit_cost AS "단가",
    p.supply_price AS "공급가",
    p.tax_amount AS "부가세",
    p.total_price AS "합계",
    p.purchase_date AS "입고일"
FROM purchases p
JOIN products pr ON p.product_id = pr.id
ORDER BY p.created_at DESC
LIMIT 5;

SELECT '최근 판매 5건' AS "검사항목";
SELECT 
    s.id::TEXT AS id,
    pr.name AS "품목명",
    s.quantity AS "수량",
    s.unit_price AS "단가",
    s.supply_price AS "공급가",
    s.tax_amount AS "부가세",
    s.total_price AS "합계",
    s.cost_of_goods_sold AS "원가",
    s.profit AS "이익",
    s.sale_date AS "판매일"
FROM sales s
JOIN products pr ON s.product_id = pr.id
ORDER BY s.created_at DESC
LIMIT 5;


-- =====================================================
-- 📊 PART 2: Phase 5 재고 조정 테스트
-- =====================================================

-- 2-1. 재고 조정 내역 확인 (✅ 실제 DB 구조에 맞게 수정)
SELECT 'Phase 5: 재고 조정 내역' AS "검사항목";
SELECT 
    ia.id::TEXT AS id,
    pr.name AS "품목명",
    ia.adjustment_type AS "조정유형",
    ia.adjustment_reason AS "사유",
    ia.quantity AS "수량",
    ia.unit_cost AS "단가",
    CASE WHEN ia.is_cancelled THEN '취소됨' ELSE '완료' END AS "상태",
    ia.adjustment_date AS "조정일"
FROM inventory_adjustments ia
JOIN products pr ON ia.product_id = pr.id
ORDER BY ia.created_at DESC
LIMIT 10;

-- 2-2. 재고 조정으로 생성된 레이어 확인
SELECT 'Phase 5: 조정으로 생성된 재고 레이어' AS "검사항목";
SELECT 
    il.id::TEXT AS id,
    pr.name AS "품목명",
    il.source_type AS "원본유형",
    il.original_quantity AS "최초수량",
    il.remaining_quantity AS "남은수량",
    il.unit_cost AS "단가",
    il.purchase_date AS "생성일"
FROM inventory_layers il
JOIN products pr ON il.product_id = pr.id
WHERE il.source_type = 'ADJUSTMENT'
ORDER BY il.created_at DESC
LIMIT 10;

-- 2-3. 재고 조정 관련 감사 로그
SELECT 'Phase 5: 재고 조정 감사 로그' AS "검사항목";
SELECT 
    al.id::TEXT,
    al.action AS "액션",
    al.product_name AS "품목명",
    al.user_name AS "사용자",
    al.changed_fields AS "변경필드",
    al.created_at::DATE AS "일시"
FROM audit_logs al
WHERE al.table_name = 'inventory_adjustments'
ORDER BY al.created_at DESC
LIMIT 10;


-- =====================================================
-- 📊 PART 3: Phase 6 판매 내역 그룹화 테스트
-- =====================================================

-- 3-1. 거래번호별 판매 그룹화
SELECT 'Phase 6: 거래번호별 판매 그룹' AS "검사항목";
SELECT 
    reference_number AS "거래번호",
    sale_date AS "판매일",
    COUNT(*) AS "품목수",
    SUM(quantity) AS "총수량",
    SUM(total_price) AS "총판매액",
    SUM(cost_of_goods_sold) AS "총원가",
    SUM(profit) AS "총이익"
FROM sales
WHERE reference_number IS NOT NULL
GROUP BY reference_number, sale_date
ORDER BY sale_date DESC, reference_number
LIMIT 10;

-- 3-2. 부가세 계산 정확성 검증
SELECT 'Phase 6: 입고 부가세 계산 검증' AS "검사항목";
SELECT 
    id::TEXT,
    quantity AS "수량",
    unit_cost AS "단가",
    supply_price AS "공급가",
    tax_amount AS "부가세",
    total_price AS "합계",
    CASE 
        WHEN ABS(supply_price + tax_amount - total_price) < 1 THEN '✅ 정상'
        ELSE '❌ 불일치'
    END AS "공급가+부가세=합계",
    CASE 
        WHEN ABS(ROUND(total_price::NUMERIC / 1.1) - supply_price) < 10 THEN '✅ 정상'
        ELSE '⚠️ 차이있음'
    END AS "공급가계산"
FROM purchases
ORDER BY created_at DESC
LIMIT 10;

-- 3-3. 판매 부가세 계산 검증
SELECT 'Phase 6: 판매 부가세 계산 검증' AS "검사항목";
SELECT 
    id::TEXT,
    quantity AS "수량",
    unit_price AS "단가",
    supply_price AS "공급가",
    tax_amount AS "부가세",
    total_price AS "합계",
    CASE 
        WHEN ABS(supply_price + tax_amount - total_price) < 1 THEN '✅ 정상'
        ELSE '❌ 불일치'
    END AS "공급가+부가세=합계"
FROM sales
ORDER BY created_at DESC
LIMIT 10;


-- =====================================================
-- 📊 PART 4: FIFO 재고 정확성 테스트
-- =====================================================

-- 4-1. 품목별 재고 현황 (레이어 기준)
SELECT 'FIFO: 품목별 재고 현황' AS "검사항목";
SELECT 
    pr.name AS "품목명",
    b.name AS "지점명",
    SUM(il.remaining_quantity) AS "현재고",
    COUNT(*) AS "레이어수",
    SUM(CASE WHEN il.remaining_quantity > 0 THEN 1 ELSE 0 END) AS "활성레이어",
    ROUND(SUM(il.remaining_quantity * il.unit_cost) / NULLIF(SUM(il.remaining_quantity), 0), 2) AS "평균단가"
FROM inventory_layers il
JOIN products pr ON il.product_id = pr.id
JOIN branches b ON il.branch_id = b.id
GROUP BY pr.id, pr.name, b.id, b.name
HAVING SUM(il.remaining_quantity) != 0
ORDER BY pr.name;

-- 4-2. 마이너스 재고 확인
SELECT 'FIFO: 마이너스 재고 품목' AS "검사항목";
SELECT 
    pr.name AS "품목명",
    b.name AS "지점명",
    SUM(il.remaining_quantity) AS "현재고"
FROM inventory_layers il
JOIN products pr ON il.product_id = pr.id
JOIN branches b ON il.branch_id = b.id
GROUP BY pr.id, pr.name, b.id, b.name
HAVING SUM(il.remaining_quantity) < 0;

-- 4-3. FIFO 레이어 상세 (특정 품목)
-- ※ 실제 테스트 시 품목 ID를 변경하세요
SELECT 'FIFO: 레이어 상세 (첫 번째 품목)' AS "검사항목";
WITH first_product AS (
    SELECT product_id FROM inventory_layers LIMIT 1
)
SELECT 
    il.id::TEXT,
    il.source_type AS "원본",
    il.purchase_date AS "입고일",
    il.original_quantity AS "최초수량",
    il.remaining_quantity AS "남은수량",
    il.unit_cost AS "단가",
    il.created_at::DATE AS "생성일"
FROM inventory_layers il
WHERE il.product_id = (SELECT product_id FROM first_product)
ORDER BY il.purchase_date ASC, il.created_at ASC;


-- =====================================================
-- 📊 PART 5: RPC 함수 테스트
-- =====================================================

-- 5-1. get_sales_list 함수 테스트
SELECT 'RPC: get_sales_list 테스트' AS "검사항목";
SELECT * FROM get_sales_list(NULL, NULL, NULL, NULL) LIMIT 5;

-- 5-2. get_purchases_list 함수 테스트
SELECT 'RPC: get_purchases_list 테스트' AS "검사항목";
SELECT * FROM get_purchases_list(NULL, NULL, NULL, NULL) LIMIT 5;

-- 5-3. get_inventory_summary 테스트 (첫 번째 지점)
SELECT 'RPC: get_inventory_summary 테스트' AS "검사항목";
WITH first_branch AS (
    SELECT id FROM branches WHERE is_active = true LIMIT 1
)
SELECT * FROM get_inventory_summary((SELECT id FROM first_branch)::TEXT) LIMIT 10;


-- =====================================================
-- 📊 PART 6: 데이터 정합성 종합 검사
-- =====================================================

-- 6-1. 재고 정합성 (수정된 쿼리 - 재고 조정 포함)
SELECT '종합: 재고 정합성 (재고조정 포함)' AS "검사항목";
WITH stock_calculation AS (
    SELECT 
        il.branch_id,
        il.product_id,
        -- 입고
        COALESCE((
            SELECT SUM(quantity) 
            FROM purchases p 
            WHERE p.branch_id = il.branch_id AND p.product_id = il.product_id
        ), 0) AS purchase_qty,
        -- 판매
        COALESCE((
            SELECT SUM(quantity) 
            FROM sales s 
            WHERE s.branch_id = il.branch_id AND s.product_id = il.product_id
        ), 0) AS sale_qty,
        -- 재고 조정 증가 (✅ is_cancelled = false로 수정)
        COALESCE((
            SELECT SUM(quantity) 
            FROM inventory_adjustments ia 
            WHERE ia.branch_id = il.branch_id 
              AND ia.product_id = il.product_id 
              AND ia.adjustment_type = 'INCREASE' 
              AND ia.is_cancelled = false
        ), 0) AS adj_increase,
        -- 재고 조정 감소 (✅ is_cancelled = false로 수정)
        COALESCE((
            SELECT SUM(quantity) 
            FROM inventory_adjustments ia 
            WHERE ia.branch_id = il.branch_id 
              AND ia.product_id = il.product_id 
              AND ia.adjustment_type = 'DECREASE' 
              AND ia.is_cancelled = false
        ), 0) AS adj_decrease
    FROM (
        SELECT DISTINCT branch_id, product_id FROM inventory_layers
    ) il
),
layer_stock AS (
    SELECT 
        branch_id,
        product_id,
        SUM(remaining_quantity) AS layer_qty
    FROM inventory_layers
    GROUP BY branch_id, product_id
)
SELECT 
    p.name AS "품목명",
    b.name AS "지점명",
    ls.layer_qty AS "레이어재고",
    (sc.purchase_qty - sc.sale_qty + sc.adj_increase - sc.adj_decrease) AS "계산재고",
    ls.layer_qty - (sc.purchase_qty - sc.sale_qty + sc.adj_increase - sc.adj_decrease) AS "차이",
    CASE 
        WHEN ABS(ls.layer_qty - (sc.purchase_qty - sc.sale_qty + sc.adj_increase - sc.adj_decrease)) < 0.01 
        THEN '✅ 정상'
        WHEN ls.layer_qty = 0 AND (sc.purchase_qty - sc.sale_qty + sc.adj_increase - sc.adj_decrease) < 0
        THEN '⚠️ 마이너스재고'
        ELSE '❌ 불일치'
    END AS "상태"
FROM stock_calculation sc
JOIN layer_stock ls ON sc.branch_id = ls.branch_id AND sc.product_id = ls.product_id
JOIN products p ON sc.product_id = p.id
JOIN branches b ON sc.branch_id = b.id
ORDER BY p.name;

-- 6-2. 이익 계산 검증
SELECT '종합: 판매 이익 계산 검증' AS "검사항목";
SELECT 
    id::TEXT,
    total_price AS "판매액",
    cost_of_goods_sold AS "원가",
    profit AS "이익",
    total_price - cost_of_goods_sold AS "계산이익",
    CASE 
        WHEN ABS(profit - (total_price - COALESCE(cost_of_goods_sold, 0))) < 1 THEN '✅ 정상'
        ELSE '⚠️ 차이있음'
    END AS "검증"
FROM sales
WHERE cost_of_goods_sold IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;


-- =====================================================
-- 📋 테스트 요약
-- =====================================================

SELECT '===== 테스트 완료 =====' AS "결과";
SELECT 
    '전체 테이블 레코드, FIFO 정확성, VAT 계산, RPC 함수가 테스트되었습니다.' AS "설명",
    '❌ 또는 ⚠️ 표시된 항목은 추가 확인이 필요합니다.' AS "주의사항";

