# Phase 6: 레포트 시스템 구현 계획서

## 📋 개요

**목표**: 구매 레포트, 판매 레포트, 이익 레포트 (월간/기간별 조회) 구현  
**예상 시간**: 8-10시간  
**비즈니스 가치**: ⭐⭐⭐⭐⭐ (경영진 핵심 요구사항)  
**권한**: 원장 이상 (0000~0001), 매니저(0002)는 본인 지점만 조회

### ⚠️ 중요: 타입 안정성 규칙

**Phase 5에서 학습한 교훈 적용**:
1. **UUID vs TEXT 타입 일치**: 모든 ID 컬럼은 `::TEXT` 명시적 캐스팅 필수
2. **RETURNS TABLE**: 모든 컬럼에 명시적 타입 캐스팅 (예: `::TEXT`, `::NUMERIC`)
3. **COALESCE 사용**: NULL 값 방지 (예: `COALESCE(SUM(price), 0)`)
4. **WHERE 절**: `p.branch_id::TEXT = v_branch_filter` (UUID → TEXT 비교)

---

## 🎯 Phase 6 세부 단계

### Phase 6-1: 권한 시스템 업데이트 (20분)

#### 6-1-1. 권한 타입 추가
**파일**: `types/permissions.ts`

```typescript
export type PermissionResource = 
  | 'users_management'
  | 'branches_management'
  | 'clients_management'
  | 'products_management'
  | 'purchases_management'
  | 'sales_management'
  | 'inventory_view'
  | 'inventory_adjustments'
  | 'audit_logs_view'
  | 'reports_view'              // ✅ 신규: 레포트 조회

// ROLE_PERMISSIONS 업데이트
'0000': [
  // ... 기존 권한
  { resource: 'reports_view', action: 'read' },
],
'0001': [
  // ... 기존 권한
  { resource: 'reports_view', action: 'read' },
],
'0002': [
  // ... 기존 권한
  { resource: 'reports_view', action: 'read' }, // 본인 지점만
],
// 0003(사용자)는 레포트 접근 불가
```

#### 6-1-2. 네비게이션 메뉴 추가
**파일**: `components/shared/Navigation.tsx`

```tsx
// 레포트 섹션 추가
{can('reports_view', 'read') && (
  <>
    <li className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">레포트</li>
    <li>
      <Link href="/reports/purchase" className={linkClass('/reports/purchase')}>
        📊 구매 레포트
      </Link>
    </li>
    <li>
      <Link href="/reports/sales" className={linkClass('/reports/sales')}>
        💰 판매 레포트
      </Link>
    </li>
    <li>
      <Link href="/reports/profit" className={linkClass('/reports/profit')}>
        📈 이익 레포트
      </Link>
    </li>
  </>
)}
```

---

### Phase 6-2: 데이터베이스 RPC 함수 (90분)

#### 6-2-1. 구매 레포트 RPC 함수
**파일**: `database/phase6_reports_rpc_functions.sql`

```sql
-- ============================================
-- 구매 레포트: 월간/기간별 집계
-- ============================================
CREATE OR REPLACE FUNCTION get_purchase_report(
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_branch_id TEXT DEFAULT NULL,      -- 조회 대상 지점 (시스템 관리자/원장만 사용)
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_group_by TEXT DEFAULT 'daily'     -- 'daily', 'monthly', 'product', 'supplier'
)
RETURNS TABLE (
  -- 그룹핑 키
  group_key TEXT,              -- 날짜 또는 품목명 또는 거래처명
  group_label TEXT,            -- 표시용 레이블
  
  -- 집계 데이터
  purchase_count INTEGER,      -- 입고 건수
  total_quantity NUMERIC,      -- 총 입고 수량
  total_supply_price NUMERIC,  -- 총 공급가
  total_tax_amount NUMERIC,    -- 총 부가세
  total_amount NUMERIC,        -- 총 입고 금액
  
  -- 추가 정보
  product_count INTEGER,       -- 품목 수 (supplier 그룹핑 시)
  supplier_count INTEGER       -- 공급업체 수 (product 그룹핑 시)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한 체크: 매니저(0002)는 본인 지점만
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다.';
  END IF;

  IF p_user_role = '0002' THEN
    v_branch_filter := p_user_branch_id;
  ELSE
    v_branch_filter := COALESCE(p_branch_id, p_user_branch_id);
  END IF;

  -- 일별 집계
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT 
      TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT AS group_key,
      TO_CHAR(p.purchase_date, 'YYYY년 MM월 DD일')::TEXT AS group_label,
      COUNT(*)::INTEGER AS purchase_count,
      COALESCE(SUM(p.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(p.supply_price), 0)::NUMERIC AS total_supply_price,
      COALESCE(SUM(p.tax_amount), 0)::NUMERIC AS total_tax_amount,
      COALESCE(SUM(p.total_price), 0)::NUMERIC AS total_amount,
      COUNT(DISTINCT p.product_id)::INTEGER AS product_count,
      COUNT(DISTINCT p.client_id)::INTEGER AS supplier_count
    FROM purchases p
    WHERE p.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
      AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
    GROUP BY p.purchase_date
    ORDER BY p.purchase_date DESC;

  -- 월별 집계
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT 
      TO_CHAR(p.purchase_date, 'YYYY-MM')::TEXT AS group_key,
      TO_CHAR(p.purchase_date, 'YYYY년 MM월')::TEXT AS group_label,
      COUNT(*)::INTEGER AS purchase_count,
      COALESCE(SUM(p.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(p.supply_price), 0)::NUMERIC AS total_supply_price,
      COALESCE(SUM(p.tax_amount), 0)::NUMERIC AS total_tax_amount,
      COALESCE(SUM(p.total_price), 0)::NUMERIC AS total_amount,
      COUNT(DISTINCT p.product_id)::INTEGER AS product_count,
      COUNT(DISTINCT p.client_id)::INTEGER AS supplier_count
    FROM purchases p
    WHERE p.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
      AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
    GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM')
    ORDER BY TO_CHAR(p.purchase_date, 'YYYY-MM') DESC;

  -- 품목별 집계
  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT 
      pr.id::TEXT AS group_key,
      pr.name::TEXT AS group_label,
      COUNT(*)::INTEGER AS purchase_count,
      COALESCE(SUM(p.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(p.supply_price), 0)::NUMERIC AS total_supply_price,
      COALESCE(SUM(p.tax_amount), 0)::NUMERIC AS total_tax_amount,
      COALESCE(SUM(p.total_price), 0)::NUMERIC AS total_amount,
      1::INTEGER AS product_count,
      COUNT(DISTINCT p.client_id)::INTEGER AS supplier_count
    FROM purchases p
    INNER JOIN products pr ON p.product_id = pr.id
    WHERE p.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
      AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
    GROUP BY pr.id, pr.name
    ORDER BY COALESCE(SUM(p.total_price), 0) DESC;

  -- 공급업체별 집계
  ELSIF p_group_by = 'supplier' THEN
    RETURN QUERY
    SELECT 
      c.id::TEXT AS group_key,
      c.name::TEXT AS group_label,
      COUNT(*)::INTEGER AS purchase_count,
      COALESCE(SUM(p.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(p.supply_price), 0)::NUMERIC AS total_supply_price,
      COALESCE(SUM(p.tax_amount), 0)::NUMERIC AS total_tax_amount,
      COALESCE(SUM(p.total_price), 0)::NUMERIC AS total_amount,
      COUNT(DISTINCT p.product_id)::INTEGER AS product_count,
      1::INTEGER AS supplier_count
    FROM purchases p
    INNER JOIN clients c ON p.client_id = c.id
    WHERE p.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
      AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
    GROUP BY c.id, c.name
    ORDER BY COALESCE(SUM(p.total_price), 0) DESC;

  ELSE
    RAISE EXCEPTION 'Invalid group_by parameter: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_purchase_report TO authenticated;
```

#### 6-2-2. 판매 레포트 RPC 함수

```sql
-- ============================================
-- 판매 레포트: 월간/기간별 집계
-- ============================================
CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_group_by TEXT DEFAULT 'daily'     -- 'daily', 'monthly', 'product', 'customer'
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  sale_count INTEGER,
  total_quantity NUMERIC,
  total_revenue NUMERIC,           -- 매출액 (판매가)
  total_cost NUMERIC,              -- 원가
  total_profit NUMERIC,            -- 이익
  avg_profit_margin NUMERIC,       -- 평균 이익률 (%)
  product_count INTEGER,
  customer_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한 체크
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다.';
  END IF;

  IF p_user_role = '0002' THEN
    v_branch_filter := p_user_branch_id;
  ELSE
    v_branch_filter := COALESCE(p_branch_id, p_user_branch_id);
  END IF;

  -- 일별 집계
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    SELECT 
      TO_CHAR(s.sale_date, 'YYYY-MM-DD')::TEXT AS group_key,
      TO_CHAR(s.sale_date, 'YYYY년 MM월 DD일')::TEXT AS group_label,
      COUNT(*)::INTEGER AS sale_count,
      COALESCE(SUM(s.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(s.total_price), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS total_cost,
      COALESCE(SUM(s.profit), 0)::NUMERIC AS total_profit,
      CASE 
        WHEN COALESCE(SUM(s.total_price), 0) > 0 
        THEN (COALESCE(SUM(s.profit), 0) / SUM(s.total_price)) * 100
        ELSE 0
      END::NUMERIC AS avg_profit_margin,
      COUNT(DISTINCT s.product_id)::INTEGER AS product_count,
      COUNT(DISTINCT s.client_id)::INTEGER AS customer_count
    FROM sales s
    WHERE s.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    GROUP BY s.sale_date
    ORDER BY s.sale_date DESC;

  -- 월별 집계
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    SELECT 
      TO_CHAR(s.sale_date, 'YYYY-MM')::TEXT AS group_key,
      TO_CHAR(s.sale_date, 'YYYY년 MM월')::TEXT AS group_label,
      COUNT(*)::INTEGER AS sale_count,
      COALESCE(SUM(s.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(s.total_price), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS total_cost,
      COALESCE(SUM(s.profit), 0)::NUMERIC AS total_profit,
      CASE 
        WHEN COALESCE(SUM(s.total_price), 0) > 0 
        THEN (COALESCE(SUM(s.profit), 0) / SUM(s.total_price)) * 100
        ELSE 0
      END::NUMERIC AS avg_profit_margin,
      COUNT(DISTINCT s.product_id)::INTEGER AS product_count,
      COUNT(DISTINCT s.client_id)::INTEGER AS customer_count
    FROM sales s
    WHERE s.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY TO_CHAR(s.sale_date, 'YYYY-MM') DESC;

  -- 품목별 집계
  ELSIF p_group_by = 'product' THEN
    RETURN QUERY
    SELECT 
      pr.id::TEXT AS group_key,
      pr.name::TEXT AS group_label,
      COUNT(*)::INTEGER AS sale_count,
      COALESCE(SUM(s.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(s.total_price), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS total_cost,
      COALESCE(SUM(s.profit), 0)::NUMERIC AS total_profit,
      CASE 
        WHEN COALESCE(SUM(s.total_price), 0) > 0 
        THEN (COALESCE(SUM(s.profit), 0) / SUM(s.total_price)) * 100
        ELSE 0
      END::NUMERIC AS avg_profit_margin,
      1::INTEGER AS product_count,
      COUNT(DISTINCT s.client_id)::INTEGER AS customer_count
    FROM sales s
    INNER JOIN products pr ON s.product_id = pr.id
    WHERE s.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    GROUP BY pr.id, pr.name
    ORDER BY COALESCE(SUM(s.profit), 0) DESC;

  -- 고객별 집계
  ELSIF p_group_by = 'customer' THEN
    RETURN QUERY
    SELECT 
      c.id::TEXT AS group_key,
      c.name::TEXT AS group_label,
      COUNT(*)::INTEGER AS sale_count,
      COALESCE(SUM(s.quantity), 0)::NUMERIC AS total_quantity,
      COALESCE(SUM(s.total_price), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS total_cost,
      COALESCE(SUM(s.profit), 0)::NUMERIC AS total_profit,
      CASE 
        WHEN COALESCE(SUM(s.total_price), 0) > 0 
        THEN (COALESCE(SUM(s.profit), 0) / SUM(s.total_price)) * 100
        ELSE 0
      END::NUMERIC AS avg_profit_margin,
      COUNT(DISTINCT s.product_id)::INTEGER AS product_count,
      1::INTEGER AS customer_count
    FROM sales s
    INNER JOIN clients c ON s.client_id = c.id
    WHERE s.branch_id::TEXT = v_branch_filter
      AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
    GROUP BY c.id, c.name
    ORDER BY COALESCE(SUM(s.profit), 0) DESC;

  ELSE
    RAISE EXCEPTION 'Invalid group_by parameter: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report TO authenticated;
```

#### 6-2-3. 이익 레포트 RPC 함수 (통합)

```sql
-- ============================================
-- 이익 레포트: 구매/판매 통합 분석
-- ============================================
CREATE OR REPLACE FUNCTION get_profit_report(
  p_user_id TEXT,
  p_user_role TEXT,
  p_user_branch_id TEXT,
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_group_by TEXT DEFAULT 'monthly'   -- 'daily', 'monthly'
)
RETURNS TABLE (
  group_key TEXT,
  group_label TEXT,
  
  -- 구매 데이터
  purchase_count INTEGER,
  purchase_amount NUMERIC,
  
  -- 판매 데이터
  sale_count INTEGER,
  sale_revenue NUMERIC,
  sale_cost NUMERIC,
  sale_profit NUMERIC,
  profit_margin NUMERIC,
  
  -- 재고 변동 (순증감)
  net_inventory_change NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_filter TEXT;
BEGIN
  -- 권한 체크
  IF p_user_role NOT IN ('0000', '0001', '0002') THEN
    RAISE EXCEPTION '레포트 조회 권한이 없습니다.';
  END IF;

  IF p_user_role = '0002' THEN
    v_branch_filter := p_user_branch_id;
  ELSE
    v_branch_filter := COALESCE(p_branch_id, p_user_branch_id);
  END IF;

  -- 일별 통합 집계
  IF p_group_by = 'daily' THEN
    RETURN QUERY
    WITH purchase_summary AS (
      SELECT 
        p.purchase_date AS date_key,
        COUNT(*)::INTEGER AS p_count,
        COALESCE(SUM(p.total_price), 0)::NUMERIC AS p_amount
      FROM purchases p
      WHERE p.branch_id::TEXT = v_branch_filter
        AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
        AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
      GROUP BY p.purchase_date
    ),
    sale_summary AS (
      SELECT 
        s.sale_date AS date_key,
        COUNT(*)::INTEGER AS s_count,
        COALESCE(SUM(s.total_price), 0)::NUMERIC AS s_revenue,
        COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS s_cost,
        COALESCE(SUM(s.profit), 0)::NUMERIC AS s_profit
      FROM sales s
      WHERE s.branch_id::TEXT = v_branch_filter
        AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
        AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
      GROUP BY s.sale_date
    )
    SELECT 
      TO_CHAR(COALESCE(ps.date_key, ss.date_key), 'YYYY-MM-DD')::TEXT AS group_key,
      TO_CHAR(COALESCE(ps.date_key, ss.date_key), 'YYYY년 MM월 DD일')::TEXT AS group_label,
      COALESCE(ps.p_count, 0)::INTEGER AS purchase_count,
      COALESCE(ps.p_amount, 0)::NUMERIC AS purchase_amount,
      COALESCE(ss.s_count, 0)::INTEGER AS sale_count,
      COALESCE(ss.s_revenue, 0)::NUMERIC AS sale_revenue,
      COALESCE(ss.s_cost, 0)::NUMERIC AS sale_cost,
      COALESCE(ss.s_profit, 0)::NUMERIC AS sale_profit,
      CASE 
        WHEN COALESCE(ss.s_revenue, 0) > 0 
        THEN (COALESCE(ss.s_profit, 0) / ss.s_revenue) * 100
        ELSE 0
      END::NUMERIC AS profit_margin,
      (COALESCE(ps.p_amount, 0) - COALESCE(ss.s_cost, 0))::NUMERIC AS net_inventory_change
    FROM purchase_summary ps
    FULL OUTER JOIN sale_summary ss ON ps.date_key = ss.date_key
    ORDER BY COALESCE(ps.date_key, ss.date_key) DESC;

  -- 월별 통합 집계
  ELSIF p_group_by = 'monthly' THEN
    RETURN QUERY
    WITH purchase_summary AS (
      SELECT 
        TO_CHAR(p.purchase_date, 'YYYY-MM') AS month_key,
        COUNT(*)::INTEGER AS p_count,
        COALESCE(SUM(p.total_price), 0)::NUMERIC AS p_amount
      FROM purchases p
      WHERE p.branch_id::TEXT = v_branch_filter
        AND (p_start_date IS NULL OR p.purchase_date >= p_start_date)
        AND (p_end_date IS NULL OR p.purchase_date <= p_end_date)
      GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM')
    ),
    sale_summary AS (
      SELECT 
        TO_CHAR(s.sale_date, 'YYYY-MM') AS month_key,
        COUNT(*)::INTEGER AS s_count,
        COALESCE(SUM(s.total_price), 0)::NUMERIC AS s_revenue,
        COALESCE(SUM(s.cost_of_goods_sold), 0)::NUMERIC AS s_cost,
        COALESCE(SUM(s.profit), 0)::NUMERIC AS s_profit
      FROM sales s
      WHERE s.branch_id::TEXT = v_branch_filter
        AND (p_start_date IS NULL OR s.sale_date >= p_start_date)
        AND (p_end_date IS NULL OR s.sale_date <= p_end_date)
      GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    )
    SELECT 
      COALESCE(ps.month_key, ss.month_key)::TEXT AS group_key,
      TO_CHAR(TO_DATE(COALESCE(ps.month_key, ss.month_key), 'YYYY-MM'), 'YYYY년 MM월')::TEXT AS group_label,
      COALESCE(ps.p_count, 0)::INTEGER AS purchase_count,
      COALESCE(ps.p_amount, 0)::NUMERIC AS purchase_amount,
      COALESCE(ss.s_count, 0)::INTEGER AS sale_count,
      COALESCE(ss.s_revenue, 0)::NUMERIC AS sale_revenue,
      COALESCE(ss.s_cost, 0)::NUMERIC AS sale_cost,
      COALESCE(ss.s_profit, 0)::NUMERIC AS sale_profit,
      CASE 
        WHEN COALESCE(ss.s_revenue, 0) > 0 
        THEN (COALESCE(ss.s_profit, 0) / ss.s_revenue) * 100
        ELSE 0
      END::NUMERIC AS profit_margin,
      (COALESCE(ps.p_amount, 0) - COALESCE(ss.s_cost, 0))::NUMERIC AS net_inventory_change
    FROM purchase_summary ps
    FULL OUTER JOIN sale_summary ss ON ps.month_key = ss.month_key
    ORDER BY COALESCE(ps.month_key, ss.month_key) DESC;

  ELSE
    RAISE EXCEPTION 'Invalid group_by parameter: %', p_group_by;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_profit_report TO authenticated;
```

---

### Phase 6-3: TypeScript 타입 정의 (30분)

**파일**: `types/reports.ts`

```typescript
// ============================================
// 레포트 공통 타입
// ============================================

/**
 * 그룹핑 타입
 */
export type ReportGroupBy = 'daily' | 'monthly' | 'product' | 'supplier' | 'customer'

/**
 * 날짜 범위 선택
 */
export interface DateRange {
  start_date: string | null  // YYYY-MM-DD
  end_date: string | null
}

/**
 * 레포트 필터
 */
export interface ReportFilter {
  branch_id: string | null
  start_date: string | null
  end_date: string | null
  group_by: ReportGroupBy
}

// ============================================
// 구매 레포트
// ============================================

/**
 * 구매 레포트 행 데이터
 */
export interface PurchaseReportRow {
  group_key: string           // 날짜 또는 ID
  group_label: string         // 표시용 레이블
  purchase_count: number      // 입고 건수
  total_quantity: number      // 총 수량
  total_supply_price: number  // 총 공급가
  total_tax_amount: number    // 총 부가세
  total_amount: number        // 총 금액
  product_count: number       // 품목 수
  supplier_count: number      // 공급업체 수
}

/**
 * 구매 레포트 요약
 */
export interface PurchaseReportSummary {
  total_purchases: number
  total_amount: number
  total_quantity: number
  unique_products: number
  unique_suppliers: number
}

// ============================================
// 판매 레포트
// ============================================

/**
 * 판매 레포트 행 데이터
 */
export interface SalesReportRow {
  group_key: string
  group_label: string
  sale_count: number
  total_quantity: number
  total_revenue: number       // 매출액
  total_cost: number          // 원가
  total_profit: number        // 이익
  avg_profit_margin: number   // 평균 이익률 (%)
  product_count: number
  customer_count: number
}

/**
 * 판매 레포트 요약
 */
export interface SalesReportSummary {
  total_sales: number
  total_revenue: number
  total_cost: number
  total_profit: number
  avg_profit_margin: number
  unique_products: number
  unique_customers: number
}

// ============================================
// 이익 레포트
// ============================================

/**
 * 이익 레포트 행 데이터
 */
export interface ProfitReportRow {
  group_key: string
  group_label: string
  
  // 구매
  purchase_count: number
  purchase_amount: number
  
  // 판매
  sale_count: number
  sale_revenue: number
  sale_cost: number
  sale_profit: number
  profit_margin: number
  
  // 재고 변동
  net_inventory_change: number
}

/**
 * 이익 레포트 요약
 */
export interface ProfitReportSummary {
  total_purchase_amount: number
  total_sale_revenue: number
  total_sale_cost: number
  total_profit: number
  overall_profit_margin: number
  net_inventory_value: number
}

// ============================================
// 차트 데이터
// ============================================

/**
 * 라인 차트 데이터 포인트
 */
export interface ChartDataPoint {
  label: string
  value: number
}

/**
 * 멀티 라인 차트 데이터
 */
export interface MultiLineChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color: string
  }[]
}

// ============================================
// Server Actions 응답
// ============================================

export interface ReportResponse<T> {
  success: boolean
  data: T[]
  summary?: any
  message?: string
}
```

---

### Phase 6-4: Server Actions 구현 (60분)

#### 6-4-1. 구매 레포트 Actions
**파일**: `app/reports/purchase/actions.ts`

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { PurchaseReportRow, ReportFilter, ReportResponse } from '@/types/reports'

/**
 * 구매 레포트 조회
 */
export async function getPurchaseReport(
  userId: string,
  userRole: string,
  userBranchId: string,
  filter: ReportFilter
): Promise<ReportResponse<PurchaseReportRow>> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_purchase_report', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_branch_id: filter.branch_id,
      p_start_date: filter.start_date,
      p_end_date: filter.end_date,
      p_group_by: filter.group_by
    })

    if (error) {
      console.error('❌ 구매 레포트 조회 실패:', error)
      return { 
        success: false, 
        data: [], 
        message: error.message 
      }
    }

    // 요약 통계 계산
    const summary = {
      total_purchases: data?.reduce((sum, row) => sum + row.purchase_count, 0) || 0,
      total_amount: data?.reduce((sum, row) => sum + row.total_amount, 0) || 0,
      total_quantity: data?.reduce((sum, row) => sum + row.total_quantity, 0) || 0,
    }

    return { 
      success: true, 
      data: data || [],
      summary
    }
  } catch (error) {
    console.error('❌ 구매 레포트 조회 에러:', error)
    return { 
      success: false, 
      data: [], 
      message: '구매 레포트 조회 중 오류가 발생했습니다.' 
    }
  }
}
```

#### 6-4-2. 판매 레포트 Actions
**파일**: `app/reports/sales/actions.ts`

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { SalesReportRow, ReportFilter, ReportResponse } from '@/types/reports'

/**
 * 판매 레포트 조회
 */
export async function getSalesReport(
  userId: string,
  userRole: string,
  userBranchId: string,
  filter: ReportFilter
): Promise<ReportResponse<SalesReportRow>> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_sales_report', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_branch_id: filter.branch_id,
      p_start_date: filter.start_date,
      p_end_date: filter.end_date,
      p_group_by: filter.group_by
    })

    if (error) {
      console.error('❌ 판매 레포트 조회 실패:', error)
      return { 
        success: false, 
        data: [], 
        message: error.message 
      }
    }

    const summary = {
      total_sales: data?.reduce((sum, row) => sum + row.sale_count, 0) || 0,
      total_revenue: data?.reduce((sum, row) => sum + row.total_revenue, 0) || 0,
      total_cost: data?.reduce((sum, row) => sum + row.total_cost, 0) || 0,
      total_profit: data?.reduce((sum, row) => sum + row.total_profit, 0) || 0,
    }

    return { 
      success: true, 
      data: data || [],
      summary
    }
  } catch (error) {
    console.error('❌ 판매 레포트 조회 에러:', error)
    return { 
      success: false, 
      data: [], 
      message: '판매 레포트 조회 중 오류가 발생했습니다.' 
    }
  }
}
```

#### 6-4-3. 이익 레포트 Actions
**파일**: `app/reports/profit/actions.ts`

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { ProfitReportRow, ReportFilter, ReportResponse } from '@/types/reports'

/**
 * 이익 레포트 조회
 */
export async function getProfitReport(
  userId: string,
  userRole: string,
  userBranchId: string,
  filter: ReportFilter
): Promise<ReportResponse<ProfitReportRow>> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_profit_report', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_branch_id: filter.branch_id,
      p_start_date: filter.start_date,
      p_end_date: filter.end_date,
      p_group_by: filter.group_by
    })

    if (error) {
      console.error('❌ 이익 레포트 조회 실패:', error)
      return { 
        success: false, 
        data: [], 
        message: error.message 
      }
    }

    const summary = {
      total_purchase_amount: data?.reduce((sum, row) => sum + row.purchase_amount, 0) || 0,
      total_sale_revenue: data?.reduce((sum, row) => sum + row.sale_revenue, 0) || 0,
      total_sale_cost: data?.reduce((sum, row) => sum + row.sale_cost, 0) || 0,
      total_profit: data?.reduce((sum, row) => sum + row.sale_profit, 0) || 0,
    }

    return { 
      success: true, 
      data: data || [],
      summary
    }
  } catch (error) {
    console.error('❌ 이익 레포트 조회 에러:', error)
    return { 
      success: false, 
      data: [], 
      message: '이익 레포트 조회 중 오류가 발생했습니다.' 
    }
  }
}
```

---

### Phase 6-5: UI 컴포넌트 구현 (180분)

#### 6-5-1. 공통 컴포넌트

**파일**: `components/reports/ReportFilters.tsx`

```tsx
'use client'

import { useState } from 'react'
import { ReportFilter, ReportGroupBy } from '@/types/reports'

interface Props {
  onFilterChange: (filter: ReportFilter) => void
  showBranchFilter?: boolean
  branches?: { id: string; name: string }[]
  groupByOptions: { value: ReportGroupBy; label: string }[]
}

export function ReportFilters({ 
  onFilterChange, 
  showBranchFilter, 
  branches, 
  groupByOptions 
}: Props) {
  const [filter, setFilter] = useState<ReportFilter>({
    branch_id: null,
    start_date: null,
    end_date: null,
    group_by: 'monthly'
  })

  const handleChange = (updates: Partial<ReportFilter>) => {
    const newFilter = { ...filter, ...updates }
    setFilter(newFilter)
    onFilterChange(newFilter)
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 지점 선택 (시스템 관리자/원장만) */}
        {showBranchFilter && branches && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              지점
            </label>
            <select
              value={filter.branch_id || ''}
              onChange={(e) => handleChange({ branch_id: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">전체 지점</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 시작일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시작일
          </label>
          <input
            type="date"
            value={filter.start_date || ''}
            onChange={(e) => handleChange({ start_date: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* 종료일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            종료일
          </label>
          <input
            type="date"
            value={filter.end_date || ''}
            onChange={(e) => handleChange({ end_date: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* 그룹핑 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            집계 기준
          </label>
          <select
            value={filter.group_by}
            onChange={(e) => handleChange({ group_by: e.target.value as ReportGroupBy })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {groupByOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 빠른 날짜 선택 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const today = new Date()
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            handleChange({
              start_date: startOfMonth.toISOString().split('T')[0],
              end_date: today.toISOString().split('T')[0]
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          이번 달
        </button>
        <button
          onClick={() => {
            const today = new Date()
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
            handleChange({
              start_date: lastMonth.toISOString().split('T')[0],
              end_date: endOfLastMonth.toISOString().split('T')[0]
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          지난 달
        </button>
        <button
          onClick={() => {
            const today = new Date()
            const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
            handleChange({
              start_date: threeMonthsAgo.toISOString().split('T')[0],
              end_date: today.toISOString().split('T')[0]
            })
          }}
          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          최근 3개월
        </button>
      </div>
    </div>
  )
}
```

**파일**: `components/reports/ReportSummaryCards.tsx`

```tsx
'use client'

import { StatCard } from '@/components/shared/StatCard'

interface SummaryCard {
  label: string
  value: string | number
  unit?: string
  icon?: string
  variant?: 'default' | 'primary' | 'success'
}

interface Props {
  cards: SummaryCard[]
}

export function ReportSummaryCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <StatCard
          key={index}
          label={card.label}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          variant={card.variant}
        />
      ))}
    </div>
  )
}
```

#### 6-5-2. 구매 레포트 페이지

**파일**: `app/reports/purchase/page.tsx`

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/shared/ContentCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PurchaseReportView } from '@/components/reports/PurchaseReportView'

export default async function PurchaseReportPage() {
  // 세션 검증
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: sessionData, error: sessionError } = await supabase.rpc('verify_session', {
    p_token: token
  })

  if (sessionError || !sessionData?.[0]?.valid) {
    redirect('/login')
  }

  const userSession = {
    user_id: sessionData[0].user_id,
    username: sessionData[0].username,
    role: sessionData[0].role,
    branch_id: sessionData[0].branch_id,
    branch_name: sessionData[0].branch_name || ''
  }

  // 권한 체크: 원장 이상
  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    redirect('/')
  }

  // 지점 목록 (시스템 관리자/원장만)
  let branches: any[] = []
  if (['0000', '0001'].includes(userSession.role)) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    branches = branchData || []
  }

  return (
    <>
      <NavigationWrapper user={userSession} />
      <PageLayout>
        <ContentCard>
          <PageHeader
            title="📊 구매 레포트"
            description="기간별 구매 현황 분석"
          />
          <PurchaseReportView
            session={userSession}
            branches={branches}
          />
        </ContentCard>
      </PageLayout>
    </>
  )
}
```

**파일**: `components/reports/PurchaseReportView.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ReportFilters } from './ReportFilters'
import { ReportSummaryCards } from './ReportSummaryCards'
import { PurchaseReportRow, ReportFilter } from '@/types/reports'
import { getPurchaseReport } from '@/app/reports/purchase/actions'

interface Props {
  session: {
    user_id: string
    role: string
    branch_id: string
    branch_name: string
  }
  branches: { id: string; name: string }[]
}

export function PurchaseReportView({ session, branches }: Props) {
  const [data, setData] = useState<PurchaseReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)

  const handleFilterChange = async (filter: ReportFilter) => {
    setLoading(true)
    const result = await getPurchaseReport(
      session.user_id,
      session.role,
      session.branch_id,
      filter
    )
    
    if (result.success) {
      setData(result.data)
      setSummary(result.summary)
    }
    setLoading(false)
  }

  const summaryCards = summary ? [
    { label: '총 입고 건수', value: summary.total_purchases, unit: '건', icon: '📦', variant: 'primary' as const },
    { label: '총 입고 수량', value: summary.total_quantity.toLocaleString(), icon: '📊', variant: 'primary' as const },
    { label: '총 입고 금액', value: `₩${summary.total_amount.toLocaleString()}`, icon: '💰', variant: 'success' as const },
  ] : []

  return (
    <div className="space-y-6">
      <ReportFilters
        onFilterChange={handleFilterChange}
        showBranchFilter={['0000', '0001'].includes(session.role)}
        branches={branches}
        groupByOptions={[
          { value: 'daily', label: '일별' },
          { value: 'monthly', label: '월별' },
          { value: 'product', label: '품목별' },
          { value: 'supplier', label: '공급업체별' },
        ]}
      />

      {summary && <ReportSummaryCards cards={summaryCards} />}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">데이터 로딩 중...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기간/품목</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">입고 건수</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">수량</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">공급가</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">부가세</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.group_label}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{row.purchase_count}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{row.total_quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">₩{row.total_supply_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-orange-600">₩{row.total_tax_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-blue-700">₩{row.total_amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

#### 6-5-3. 판매 레포트 페이지
(구매 레포트와 유사한 구조, `SalesReportView` 컴포넌트로 구현)

#### 6-5-4. 이익 레포트 페이지
(구매/판매 통합 분석, `ProfitReportView` 컴포넌트로 구현)

---

## 📝 실행 순서

### Step 1: 권한 시스템 업데이트 (20분)
```bash
# 파일 수정
- types/permissions.ts
- components/shared/Navigation.tsx
```

### Step 2: 데이터베이스 RPC 함수 생성 (90분)
```bash
# Supabase SQL Editor에서 실행
1. database/phase6_reports_rpc_functions.sql 생성
2. 3개 RPC 함수 순차 실행
   - get_purchase_report
   - get_sales_report
   - get_profit_report
3. GRANT 권한 확인
```

### Step 3: TypeScript 타입 정의 (30분)
```bash
# 파일 생성
- types/reports.ts
```

### Step 4: Server Actions 구현 (60분)
```bash
# 파일 생성
- app/reports/purchase/actions.ts
- app/reports/sales/actions.ts
- app/reports/profit/actions.ts
```

### Step 5: UI 컴포넌트 구현 (180분)
```bash
# 공통 컴포넌트
- components/reports/ReportFilters.tsx
- components/reports/ReportSummaryCards.tsx

# 페이지별 컴포넌트
- app/reports/purchase/page.tsx
- components/reports/PurchaseReportView.tsx
- app/reports/sales/page.tsx
- components/reports/SalesReportView.tsx
- app/reports/profit/page.tsx
- components/reports/ProfitReportView.tsx
```

### Step 6: 테스트 (60분)
1. **권한 테스트**
   - 사용자(0003) 접근 차단 확인
   - 매니저(0002) 본인 지점만 조회 확인
   - 원장(0001) 전체 지점 조회 확인

2. **데이터 정확성**
   - 일별/월별 집계 검증
   - 품목별/거래처별 집계 검증
   - 이익률 계산 검증

3. **UI/UX**
   - 빠른 날짜 선택 버튼 동작
   - 필터 변경 시 자동 갱신
   - 로딩 상태 표시

---

## 🎯 완료 기준

### ✅ 기능 완료
- [ ] 구매 레포트 (일별/월별/품목별/공급업체별)
- [ ] 판매 레포트 (일별/월별/품목별/고객별)
- [ ] 이익 레포트 (월간 통합 분석)
- [ ] 권한별 접근 제어
- [ ] 날짜 범위 필터
- [ ] 요약 통계 카드

### ✅ 코드 품질
- [ ] TypeScript 타입 안정성
- [ ] Server Actions 에러 처리
- [ ] RPC 함수 권한 검증
- [ ] 컴포넌트 재사용성

---

## 🚀 향후 확장 계획 (Phase 7)

### 차트 시각화
- **라이브러리**: Chart.js 또는 Recharts
- **차트 종류**:
  - 라인 차트: 월별 매출/이익 추이
  - 바 차트: 품목별 판매량 순위
  - 파이 차트: 거래처별 매출 비중

### PDF/Excel 출력
- **라이브러리**: `jsPDF`, `xlsx`
- **기능**:
  - 레포트 PDF 다운로드
  - Excel 데이터 내보내기
  - 인쇄 레이아웃 최적화

---

## 📊 예상 효과

### 비즈니스 가치
1. **실시간 경영 분석**: 매출/이익 즉시 확인
2. **의사결정 지원**: 품목별/거래처별 성과 비교
3. **재고 최적화**: 구매/판매 패턴 파악

### 기술적 가치
1. **재사용성**: 공통 컴포넌트로 향후 레포트 확장 용이
2. **권한 통합**: 기존 권한 시스템과 완벽 통합
3. **성능**: RPC 함수로 DB 레벨 집계 (빠른 응답)

---

## 💡 개발 시 주의사항

### 1. 타입 안정성 (Phase 5 교훈)
- **UUID → TEXT 변환**: `WHERE p.branch_id::TEXT = v_branch_filter`
- **명시적 캐스팅**: SELECT 절에서 `::TEXT`, `::NUMERIC`, `::INTEGER` 필수
- **COALESCE 사용**: `COALESCE(SUM(price), 0)` (NULL 방지)
- **RETURNS TABLE**: 반환 타입과 SELECT 타입 정확히 일치시키기

### 2. 데이터베이스 규칙
- **날짜 형식**: YYYY-MM-DD (ISO 8601)
- **NULL 처리**: 날짜 필터 NULL일 때 전체 조회
- **권한 검증**: RPC 함수 내부에서 이중 체크 (`p_user_role NOT IN ...`)
- **매니저 제약**: branch_id 강제 필터링 (0002 역할)

### 3. 비즈니스 로직
- **부가세 계산**: supply_price + tax_amount = total_price
- **이익률**: (profit / total_price) × 100
- **재고 변동**: purchase_amount - sale_cost (FIFO 원가 기준)

### 4. 테이블 컬럼 확인 완료
- `sales.cost_of_goods_sold` ✅ 존재
- `sales.profit` ✅ 존재
- `sales.total_price` ✅ 존재 (판매 금액)
- `purchases.supply_price`, `purchases.tax_amount`, `purchases.total_price` ✅ 존재

---

**다음 단계**: Phase 6 구현 시작 시 알려주세요. 단계별로 코드를 생성해드리겠습니다! 🚀
