-- =====================================================
-- 데이터 정합성 검증 쿼리 모음
-- =====================================================
-- Phase 0에서 실행하여 현재 상태를 파악하고,
-- 각 Phase 완료 후 재실행하여 데이터 무결성 확인

-- =====================================================
-- 1. FIFO 레이어 잔량 검증
-- =====================================================
-- 목적: inventory_layers 합계 = (입고 - 판매) 확인
DROP FUNCTION IF EXISTS check_inventory_integrity() CASCADE;

CREATE OR REPLACE FUNCTION check_inventory_integrity()
RETURNS TABLE (
  branch_id UUID,
  product_id UUID,
  product_name TEXT,
  layer_stock NUMERIC,
  calculated_stock NUMERIC,
  difference NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH inventory_summary AS (
    SELECT 
      il.branch_id,
      il.product_id,
      SUM(il.remaining_quantity) AS layer_stock
    FROM inventory_layers il
    WHERE il.remaining_quantity > 0
    GROUP BY il.branch_id, il.product_id
  ),
  transaction_summary AS (
    SELECT 
      COALESCE(p.branch_id, s.branch_id) AS branch_id,
      COALESCE(p.product_id, s.product_id) AS product_id,
      COALESCE(SUM(p.quantity), 0) AS total_purchases,
      COALESCE(SUM(s.quantity), 0) AS total_sales
    FROM purchases p
    FULL OUTER JOIN sales s 
      ON p.branch_id = s.branch_id AND p.product_id = s.product_id
    GROUP BY COALESCE(p.branch_id, s.branch_id), COALESCE(p.product_id, s.product_id)
  )
  SELECT 
    COALESCE(i.branch_id, t.branch_id),
    COALESCE(i.product_id, t.product_id),
    pr.name AS product_name,
    COALESCE(i.layer_stock, 0) AS layer_stock,
    (t.total_purchases - t.total_sales) AS calculated_stock,
    COALESCE(i.layer_stock, 0) - (t.total_purchases - t.total_sales) AS difference,
    CASE 
      WHEN ABS(COALESCE(i.layer_stock, 0) - (t.total_purchases - t.total_sales)) < 0.001 THEN '✅ 정상'
      ELSE '❌ 불일치'
    END AS status
  FROM inventory_summary i
  FULL OUTER JOIN transaction_summary t 
    ON i.branch_id = t.branch_id AND i.product_id = t.product_id
  INNER JOIN products pr ON COALESCE(i.product_id, t.product_id) = pr.id
  WHERE ABS(COALESCE(i.layer_stock, 0) - (t.total_purchases - t.total_sales)) >= 0.001
  ORDER BY difference DESC;
END;
$$;

COMMENT ON FUNCTION check_inventory_integrity() IS '재고 레이어 정합성 검증: layer_stock = (입고 - 판매)';

-- =====================================================
-- 2. 고아 레코드 검증
-- =====================================================
DROP FUNCTION IF EXISTS check_orphan_records() CASCADE;

CREATE OR REPLACE FUNCTION check_orphan_records()
RETURNS TABLE (
  issue_type TEXT,
  record_id UUID,
  table_name TEXT,
  details TEXT,
  severity TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 2-1. purchases의 inventory_layer 누락
  RETURN QUERY
  SELECT 
    'ORPHAN_PURCHASE'::TEXT,
    p.id,
    'purchases'::TEXT,
    '입고 ID ' || p.id::TEXT || '의 inventory_layer가 생성되지 않음 (수량: ' || p.quantity || ')'::TEXT,
    '🔴 CRITICAL'::TEXT
  FROM purchases p
  LEFT JOIN inventory_layers il ON p.id = il.purchase_id
  WHERE il.id IS NULL;

  -- 2-2. inventory_layers의 purchase가 없는 경우
  RETURN QUERY
  SELECT 
    'ORPHAN_LAYER'::TEXT,
    il.id,
    'inventory_layers'::TEXT,
    'inventory_layer ID ' || il.id::TEXT || '의 purchase_id(' || COALESCE(il.purchase_id::TEXT, 'NULL') || ')가 purchases에 없음'::TEXT,
    '🟡 WARNING'::TEXT
  FROM inventory_layers il
  WHERE il.purchase_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM purchases WHERE id = il.purchase_id);

  -- 2-3. sales의 FIFO 원가 미계산
  RETURN QUERY
  SELECT 
    'FIFO_NOT_CALCULATED'::TEXT,
    s.id,
    'sales'::TEXT,
    '판매 ID ' || s.id::TEXT || '의 FIFO 원가(cost_of_goods_sold)가 NULL 또는 0'::TEXT,
    '🟡 WARNING'::TEXT
  FROM sales s
  WHERE s.cost_of_goods_sold IS NULL OR s.cost_of_goods_sold = 0;

  -- 2-4. 외래키 무결성 (branch_id, product_id, client_id)
  RETURN QUERY
  SELECT 
    'INVALID_BRANCH'::TEXT,
    p.id,
    'purchases'::TEXT,
    '입고의 branch_id(' || p.branch_id::TEXT || ')가 branches 테이블에 없음'::TEXT,
    '🔴 CRITICAL'::TEXT
  FROM purchases p
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE id = p.branch_id);

  RETURN QUERY
  SELECT 
    'INVALID_PRODUCT'::TEXT,
    p.id,
    'purchases'::TEXT,
    '입고의 product_id(' || p.product_id::TEXT || ')가 products 테이블에 없음'::TEXT,
    '🔴 CRITICAL'::TEXT
  FROM purchases p
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = p.product_id);
END;
$$;

COMMENT ON FUNCTION check_orphan_records() IS '고아 레코드 및 외래키 무결성 검증';

-- =====================================================
-- 3. 음수 재고 검증
-- =====================================================
DROP FUNCTION IF EXISTS check_negative_inventory() CASCADE;

CREATE OR REPLACE FUNCTION check_negative_inventory()
RETURNS TABLE (
  branch_id UUID,
  branch_name TEXT,
  product_id UUID,
  product_code TEXT,
  product_name TEXT,
  remaining_quantity NUMERIC,
  severity TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.branch_id,
    b.name AS branch_name,
    il.product_id,
    pr.code AS product_code,
    pr.name AS product_name,
    SUM(il.remaining_quantity) AS remaining_quantity,
    '🔴 CRITICAL'::TEXT AS severity
  FROM inventory_layers il
  INNER JOIN branches b ON il.branch_id = b.id
  INNER JOIN products pr ON il.product_id = pr.id
  GROUP BY il.branch_id, b.name, il.product_id, pr.code, pr.name
  HAVING SUM(il.remaining_quantity) < 0
  ORDER BY SUM(il.remaining_quantity) ASC;
END;
$$;

COMMENT ON FUNCTION check_negative_inventory() IS '음수 재고 검증 (발생하면 안됨)';

-- =====================================================
-- 4. 거래번호 중복 검증
-- =====================================================
DROP FUNCTION IF EXISTS check_duplicate_transaction_numbers() CASCADE;

CREATE OR REPLACE FUNCTION check_duplicate_transaction_numbers()
RETURNS TABLE (
  transaction_number TEXT,
  count BIGINT,
  table_name TEXT,
  severity TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- purchases 테이블
  RETURN QUERY
  SELECT 
    reference_number,
    COUNT(*) AS count,
    'purchases'::TEXT AS table_name,
    '🟡 WARNING'::TEXT AS severity
  FROM purchases
  WHERE reference_number IS NOT NULL 
    AND reference_number != ''
    AND reference_number SIMILAR TO '%[0-9]{8}-[0-9]{3}%'  -- 자동 생성 번호 패턴
  GROUP BY reference_number
  HAVING COUNT(*) > 1;

  -- sales 테이블
  RETURN QUERY
  SELECT 
    reference_number,
    COUNT(*) AS count,
    'sales'::TEXT AS table_name,
    '🟡 WARNING'::TEXT AS severity
  FROM sales
  WHERE reference_number IS NOT NULL 
    AND reference_number != ''
    AND reference_number SIMILAR TO '%[0-9]{8}-[0-9]{3}%'
  GROUP BY reference_number
  HAVING COUNT(*) > 1;
END;
$$;

COMMENT ON FUNCTION check_duplicate_transaction_numbers() IS '거래번호 중복 검증';

-- =====================================================
-- 5. 레이어별 원가 검증 (FIFO 순서)
-- =====================================================
DROP FUNCTION IF EXISTS check_fifo_layer_order() CASCADE;

CREATE OR REPLACE FUNCTION check_fifo_layer_order()
RETURNS TABLE (
  branch_id UUID,
  product_id UUID,
  product_name TEXT,
  layer_count BIGINT,
  oldest_date DATE,
  newest_date DATE,
  out_of_order_count BIGINT,
  severity TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH layer_sequence AS (
    SELECT 
      il.branch_id,
      il.product_id,
      il.purchase_date,
      il.remaining_quantity,
      LAG(il.remaining_quantity) OVER (
        PARTITION BY il.branch_id, il.product_id 
        ORDER BY il.purchase_date ASC, il.created_at ASC
      ) AS prev_remaining_quantity
    FROM inventory_layers il
    WHERE il.remaining_quantity > 0
  )
  SELECT 
    ls.branch_id,
    ls.product_id,
    pr.name AS product_name,
    COUNT(*) AS layer_count,
    MIN(ls.purchase_date) AS oldest_date,
    MAX(ls.purchase_date) AS newest_date,
    COUNT(*) FILTER (WHERE ls.prev_remaining_quantity IS NOT NULL AND ls.prev_remaining_quantity < ls.remaining_quantity) AS out_of_order_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE ls.prev_remaining_quantity IS NOT NULL AND ls.prev_remaining_quantity < ls.remaining_quantity) > 0 
      THEN '🟡 WARNING'
      ELSE '✅ 정상'
    END AS severity
  FROM layer_sequence ls
  INNER JOIN products pr ON ls.product_id = pr.id
  GROUP BY ls.branch_id, ls.product_id, pr.name
  HAVING COUNT(*) FILTER (WHERE ls.prev_remaining_quantity IS NOT NULL AND ls.prev_remaining_quantity < ls.remaining_quantity) > 0;
END;
$$;

COMMENT ON FUNCTION check_fifo_layer_order() IS 'FIFO 순서 검증: 오래된 레이어부터 소진되는지 확인';

-- =====================================================
-- 6. 전체 검증 실행 (한번에 모든 검사)
-- =====================================================
DROP FUNCTION IF EXISTS run_full_integrity_check() CASCADE;

CREATE OR REPLACE FUNCTION run_full_integrity_check()
RETURNS TABLE (
  check_name TEXT,
  issue_count BIGINT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- 1. 재고 정합성
  SELECT COUNT(*) INTO v_count FROM check_inventory_integrity();
  RETURN QUERY SELECT 
    '1. 재고 정합성 (FIFO 레이어)'::TEXT,
    v_count,
    CASE WHEN v_count = 0 THEN '✅ 정상' ELSE '❌ ' || v_count || '건 불일치' END;

  -- 2. 고아 레코드
  SELECT COUNT(*) INTO v_count FROM check_orphan_records();
  RETURN QUERY SELECT 
    '2. 고아 레코드'::TEXT,
    v_count,
    CASE WHEN v_count = 0 THEN '✅ 정상' ELSE '❌ ' || v_count || '건 발견' END;

  -- 3. 음수 재고
  SELECT COUNT(*) INTO v_count FROM check_negative_inventory();
  RETURN QUERY SELECT 
    '3. 음수 재고'::TEXT,
    v_count,
    CASE WHEN v_count = 0 THEN '✅ 정상' ELSE '🔴 ' || v_count || '건 발견 (Critical)' END;

  -- 4. 거래번호 중복
  SELECT COUNT(*) INTO v_count FROM check_duplicate_transaction_numbers();
  RETURN QUERY SELECT 
    '4. 거래번호 중복'::TEXT,
    v_count,
    CASE WHEN v_count = 0 THEN '✅ 정상' ELSE '🟡 ' || v_count || '건 중복' END;

  -- 5. FIFO 순서
  SELECT COUNT(*) INTO v_count FROM check_fifo_layer_order();
  RETURN QUERY SELECT 
    '5. FIFO 순서'::TEXT,
    v_count,
    CASE WHEN v_count = 0 THEN '✅ 정상' ELSE '🟡 ' || v_count || '건 순서 이상' END;
END;
$$;

COMMENT ON FUNCTION run_full_integrity_check() IS '전체 데이터 정합성 검증 (요약)';

-- =====================================================
-- 실행 예시
-- =====================================================

-- 전체 검증 요약
-- SELECT * FROM run_full_integrity_check();

-- 상세 검증 (이슈 발견 시)
-- SELECT * FROM check_inventory_integrity();
-- SELECT * FROM check_orphan_records();
-- SELECT * FROM check_negative_inventory();
-- SELECT * FROM check_duplicate_transaction_numbers();
-- SELECT * FROM check_fifo_layer_order();
