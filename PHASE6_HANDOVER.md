# Phase 6: 판매 내역 그룹화 및 부가세 로직 개선 - 인수인계서

**작성일**: 2025-12-04  
**상태**: Phase 6 완료 (판매 내역 그룹화 + 부가세 계산 로직 개선)  
**다음 작업**: Phase 7 (아래 참고)

---

## 📊 전체 진행 현황

### Phase 별 완료도
- ✅ **Phase 0**: 데이터베이스 초기 설정 (세션, 사용자, 거래처 등)
- ✅ **Phase 1**: 배치 처리 및 권한 관리 시스템
- ✅ **Phase 2**: 권한 검증 및 감시 로그
- ✅ **Phase 3**: 감시 로그 시스템 완성
- ✅ **Phase 3.5**: 필드명 매핑 및 타입 캐스팅 수정
- ✅ **Phase 4**: 입고/판매 부가세 기능 구현
- ✅ **Phase 5**: 재고 조정 시스템 완성
- ✅ **Phase 6**: 판매 내역 그룹화 및 부가세 로직 개선
- ✅ **Phase 6.5**: 카테고리 관리 + 레포트 필터 개선 **← 현재**
- ⏳ **Phase 7**: [다음 작업 계획]

---

## 🎯 Phase 6.5 핵심 완료 작업 (2025-12-09)

### 1️⃣ 카테고리 관리 시스템 (신규 구현)

#### A. 데이터베이스 (RPC 함수 5개)
**파일**: `database/product_categories_rpc.sql`
- ✅ `get_categories_list()` - 카테고리 목록 + 품목 개수
- ✅ `create_category()` - 카테고리 생성 (코드/이름 중복 체크)
- ✅ `update_category()` - 카테고리 수정
- ✅ `delete_category()` - 카테고리 삭제 (품목 있으면 방지)
- ✅ `update_categories_order()` - 표시 순서 일괄 변경

#### B. 프론트엔드 (5개 파일)
- **페이지**: `app/admin/categories/page.tsx` - URL: `/admin/categories`
- **Actions**: `app/admin/categories/actions.ts` - Server Actions 4개
- **컴포넌트**: 
  - `components/admin/categories/CategoryManagement.tsx` - 메인 컨테이너
  - `components/admin/categories/CategoryTable.tsx` - 목록 테이블
  - `components/admin/categories/CategoryForm.tsx` - 추가/수정 폼

#### C. 권한 시스템 통합
**파일**: `types/permissions.ts`
```typescript
| 'admin_settings'  // 신규 리소스 추가
```

**파일**: `components/shared/Navigation.tsx`
```tsx
// 관리 메뉴에 카테고리 추가
{
  href: '/admin/categories',
  label: '카테고리',
  icon: '🏷️',
  resource: 'admin_settings',
  action: 'read',
}
```

### 2️⃣ 레포트 카테고리 필터 추가

#### A. 데이터베이스 (RPC 함수 3개 수정)
**파일**: `database/add_category_filter_to_reports.sql`
- ✅ `get_sales_report()` - 7번째 파라미터 `p_category_id` 추가
- ✅ `get_purchase_report()` - 6번째 파라미터 `p_category_id` 추가
- ✅ `get_summary_report()` - 6번째 파라미터 `p_category_id` 추가

**핵심 변경**:
```sql
-- products 테이블 조인 추가
LEFT JOIN products p ON s.product_id = p.id

-- WHERE 절에 카테고리 필터 추가
AND (p_category_id IS NULL OR p_category_id = '' OR p.category_id::TEXT = p_category_id)
```

#### B. 타입 정의 수정
**파일**: `types/reports.ts`
```typescript
export interface ReportFilter {
  startDate: string
  endDate: string
  groupBy: ReportGroupBy
  branchId?: string | null
  categoryId?: string | null  // ✅ 추가
}
```

#### C. Server Actions 수정 (4개 파일)
1. `app/reports/profit/actions.ts` - 종합 레포트
2. `app/reports/purchases/actions.ts` - 구매 레포트
3. `app/reports/sales/actions.ts` - 판매 레포트
4. `app/reports/usage/actions.ts` - 재료비 레포트

**공통 변경**:
```typescript
await supabase.rpc('get_xxx_report', {
  ...
  p_category_id: filter.categoryId || null  // ✅ 추가
})
```

#### D. 클라이언트 컴포넌트 수정 (4개 파일)
모든 레포트 클라이언트에 카테고리 상태 및 조회 로직 추가:
```tsx
const [categories, setCategories] = useState<{id: string, name: string}[]>([])

useEffect(() => {
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (data) setCategories(data)
  }
  fetchCategories()
}, [])

<ReportFilters categories={categories} ... />
```

#### E. 필터 UI 컴포넌트 수정
**파일**: `components/reports/ReportFilters.tsx`
- 카테고리 드롭다운 UI 추가
- "전체 카테고리" 옵션 (기본값)

### 3️⃣ 레포트 데이터 매핑 수정 (중요 버그 수정)

**문제**: DB 컬럼명과 TypeScript 매핑 불일치

#### 수정 내역:
**파일**: `app/reports/purchases/actions.ts`
```typescript
// ❌ 수정 전
average_unit_cost: parseFloat(item.average_unit_cost) || 0,
product_count: parseInt(item.product_count, 10) || 0,

// ✅ 수정 후
average_unit_cost: parseFloat(item.avg_unit_cost) || 0,      // DB 컬럼명 사용
product_count: parseInt(item.unique_products, 10) || 0,      // DB 컬럼명 사용
```

**파일**: `app/reports/sales/actions.ts`
```typescript
// ❌ 수정 전
average_unit_price: parseFloat(item.average_unit_price) || 0,
product_count: parseInt(item.product_count, 10) || 0,

// ✅ 수정 후
average_unit_price: parseFloat(item.avg_unit_price) || 0,      // DB 컬럼명 사용
product_count: parseInt(item.unique_products, 10) || 0,        // DB 컬럼명 사용
```

**영향**: 레포트 페이지에서 평균 단가 및 품목 수가 정상적으로 표시됨

---

## 🎯 Phase 6 핵심 완료 작업 (2025-12-04)

### 1️⃣ 판매 내역 그룹화 (입고 내역과 동일한 UX)

#### A. 타입 정의 완료
**파일**: `types/sales.ts`
```typescript
export interface SaleGroup {
  reference_number: string          // 거래번호 (그룹 키)
  sale_date: string                 // 판매일
  customer_name: string             // 거래처명
  items: SaleHistory[]              // 판매 품목 배열
  total_amount: number              // 그룹 총 판매액
  total_items: number               // 품목 수
  first_product_name: string        // 첫 번째 품목명 (리스트 요약용)
}
```

#### B. 프론트엔드 컴포넌트 완성
**파일**: `components/sales/salehistorytable.tsx` (380줄)
- 거래번호 기준 그룹화
- 날짜 필터 (시작일/종료일 + 빠른 선택: 오늘/이번주/이번달)
- 반응형 레이아웃 (모바일/테블릿/데스크탑)
- 7개 열: 거래번호 | 판매일 | 거래처 | 품목명 | 품목 수 | 총 판매액 | 상세

**파일**: `components/sales/SaleDetailModal.tsx` (210줄)
- 거래번호별 판매 품목 상세 모달
- 개별 편집/삭제 기능 (향후 확장용)
- 통계 정보: 품목 수, 총 판매액, 총 이익

#### C. 데이터 페칭 로직 수정
**파일**: `app/sales/actions.ts` - `getSalesHistory()` 함수
```typescript
// 필드 매핑 수정
{
  total_amount: item.total_amount || 0,        // ✅ RPC: total_price → total_amount (별칭)
  cost_of_goods: item.cost_of_goods || 0,      // ✅ RPC: cost_of_goods_sold → cost_of_goods
  customer_name: item.customer_name || '',      // ✅ RPC: client_name → customer_name
  profit_margin: item.total_amount > 0 ? 
    Math.round((item.total_amount - item.cost_of_goods) / item.total_amount * 100) : 0
}
```

### 2️⃣ RPC 함수 수정 (get_sales_list)

**파일**: `database/purchases_sales_rpc_functions.sql`

#### 문제 원인
- RPC 함수에서 `total_amount` 별칭을 사용하지 않음
- VARCHAR 필드를 TEXT로 변환하지 않음
- INTEGER 필드를 NUMERIC으로 캐스팅하지 않음

#### 해결 내용
```sql
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_user_id TEXT
)
RETURNS TABLE (
  id TEXT,
  reference_number TEXT,
  sale_date TEXT,
  quantity NUMERIC,                    -- ✅ INTEGER → NUMERIC
  unit_price NUMERIC,
  total_amount NUMERIC,                -- ✅ total_price AS total_amount (별칭)
  cost_of_goods NUMERIC,               -- ✅ cost_of_goods_sold AS cost_of_goods
  profit NUMERIC,
  branch_name TEXT,                    -- ✅ VARCHAR → TEXT
  customer_name TEXT,                  -- ✅ client_name AS customer_name (별칭)
  product_code TEXT,                   -- ✅ VARCHAR → TEXT
  product_name TEXT,                   -- ✅ VARCHAR → TEXT
  created_by TEXT
)
```

**핵심 SELECT 절**:
```sql
s.id::TEXT,
s.reference_number::TEXT,
s.sale_date::TEXT,
s.quantity::NUMERIC,                           -- 타입 명시
s.unit_price,
s.total_price AS total_amount,                 -- ✅ 별칭 추가
COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods,  -- ✅ 별칭 추가
COALESCE(s.profit, 0),
b.name::TEXT AS branch_name,                   -- ✅ TEXT 캐스팅
c.name::TEXT AS customer_name,                 -- ✅ 별칭 + TEXT 캐스팅
pr.code::TEXT,
pr.name::TEXT,
s.created_by::TEXT
```

### 3️⃣ AG Grid 에러 해결

**파일**: `components/sales/salegrid.tsx`

#### 문제
- Grid 파괴 중 `refreshCells()` 호출 시 에러 발생
- 페이지 새로고침 시 Grid가 언마운트되는데 비동기 콜백 실행

#### 해결
```typescript
// handleProductSelect 함수 (138-145줄)
setTimeout(() => {
  try {
    if (gridRef.current?.api && rowNode?.data) {
      gridRef.current.api.refreshCells({
        rowNodes: [rowNode],
        columns: ['supply_price', 'tax_amount', 'total_price'],
        force: true
      })
    }
  } catch (e) {
    // 페이지 새로고침 중 Grid 파괴 에러 무시
  }
}, 0)

// onCellValueChanged 함수 (297-312줄)
try {
  if (params.api && params.node) {
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['supply_price', 'tax_amount', 'total_price']
    })
  }
} catch (e) {
  // 에러 무시
}
```

### 4️⃣ 입고 관리 부가세 로직 개선

**파일**: `components/purchases/PurchaseGrid.tsx` - `calculatePrices()` 함수

#### 문제
부가세 미포함 모드에서 입력한 단가를 부가세 포함으로 자동 변환하여 재고에 저장하지 않음

#### 해결 (2025-12-04 완료)
```typescript
function calculatePrices(row: PurchaseGridRow, isTaxIncluded: boolean) {
  const quantity = row.quantity || 0
  const inputUnitCost = row.unit_cost || 0  // 사용자가 입력한 단가
  
  if (isTaxIncluded) {
    // 부가세 포함: 수량 * 단가 = 합계
    const totalPrice = quantity * inputUnitCost
    const supplyPrice = Math.round(totalPrice / 1.1)
    const taxAmount = totalPrice - supplyPrice
    
    row.total_price = totalPrice
    row.supply_price = supplyPrice
    row.tax_amount = taxAmount
    row.total_cost = totalPrice
    // unit_cost는 그대로 유지
  } else {
    // 부가세 미포함: 수량 * 단가 = 공급가
    const supplyPrice = quantity * inputUnitCost
    const taxAmount = Math.round(supplyPrice * 0.1)
    const totalPrice = supplyPrice + taxAmount
    
    row.supply_price = supplyPrice
    row.tax_amount = taxAmount
    row.total_price = totalPrice
    row.total_cost = totalPrice
    
    // ✅ 핵심: unit_cost를 부가세 포함 단가로 변환 (재고 저장용)
    // 입력 단가 × 1.1 = 부가세 포함 단가
    row.unit_cost = Math.round(inputUnitCost * 1.1)
  }
}
```

**비즈니스 로직 설명**:
- **부가세 포함 모드**: 입력 11,000 → 재고 11,000 저장
- **부가세 미포함 모드**: 입력 10,000 → 재고 11,000 저장 (자동 변환)
- 재고현황에서 **항상 부가세 포함 금액** 표시
- FIFO 원가 계산의 정확성 유지

---

## 🔧 데이터베이스 구조 (현재 상태)

### 핵심 테이블

#### `purchases` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID                    -- 지점
client_id UUID                    -- 공급업체
product_id UUID                   -- 품목
purchase_date DATE                -- 입고일
quantity NUMERIC(15, 4)          -- 수량
unit_cost NUMERIC(15, 2)         -- 단가 (사용자 입력)
supply_price NUMERIC(15, 2)      -- 공급가 (부가세 제외)
tax_amount NUMERIC(15, 2)        -- 부가세
total_price NUMERIC(15, 2)       -- 합계
total_cost NUMERIC(15, 2)        -- = total_price (호환성)
reference_number TEXT            -- 거래번호
notes TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

#### `sales` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID                    -- 지점
client_id UUID                    -- 고객
product_id UUID                   -- 품목
sale_date DATE                    -- 판매일
quantity NUMERIC(15, 4)          -- 수량
unit_price NUMERIC(15, 2)        -- 단가
supply_price NUMERIC(15, 2)      -- 공급가
tax_amount NUMERIC(15, 2)        -- 부가세
total_price NUMERIC(15, 2)       -- 합계
total_cost NUMERIC(15, 2)        -- = total_price
cost_of_goods_sold NUMERIC(15, 2) -- FIFO 원가
profit NUMERIC(15, 2)            -- 이익
reference_number TEXT
notes TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

#### `inventory_layers` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID
product_id UUID
purchase_date DATE
quantity NUMERIC(15, 4)         -- 초기 수량
remaining_quantity NUMERIC(15, 4) -- 남은 수량 (차감 추적)
unit_cost NUMERIC(15, 2)        -- 단가 (부가세 포함)
source_type TEXT                -- 'PURCHASE', 'ADJUSTMENT'
source_id TEXT                  -- 구매/조정 ID
created_at TIMESTAMPTZ
```

---

## 📝 RPC 함수 목록

### 판매/입고 관련 RPC (Phase 4-6)
| 함수명 | 용도 | 파라미터 | 반환 |
|--------|------|---------|------|
| `get_sales_list()` | 판매 내역 조회 | branch_id, start_date, end_date, user_id | TABLE (판매 데이터) |
| `get_purchases_list()` | 입고 내역 조회 | branch_id, start_date, end_date, user_id | TABLE (입고 데이터) |
| `process_sale_with_fifo()` | 판매 처리 (FIFO) | branch_id, client_id, product_id, quantity, unit_price, supply_price, tax_amount, total_price, sale_date, created_by | success, message |
| `process_purchase_with_layers()` | 입고 처리 | branch_id, client_id, product_id, quantity, unit_cost, supply_price, tax_amount, total_price, purchase_date, created_by | success, message |

### 재고 조정 RPC (Phase 5)
| 함수명 | 용도 | 파라미터 | 반환 |
|--------|------|---------|------|
| `process_inventory_adjustment()` | 재고 조정 | branch_id, product_id, adjustment_type, quantity, reason, created_by | success, message |
| `get_inventory_adjustments()` | 조정 내역 조회 | branch_id, user_id | TABLE (조정 데이터) |
| `cancel_inventory_adjustment()` | 조정 취소 | adjustment_id, user_id | success, message |

---

## 🎨 프론트엔드 컴포넌트 변화

### 입고 관리 (`app/purchases/`)
```
✅ 완료:
- PurchaseForm.tsx: 부가세 드롭박스 + 자동계산
- PurchaseGrid.tsx: 7열 레이아웃 + calculatePrices 개선
- PurchaseHistoryTable.tsx: 거래번호 그룹화 (Phase 4)
- app/purchases/page.tsx: 세션 검증 + 데이터 페칭
- app/purchases/actions.ts: 6개 Server Actions
```

### 판매 관리 (`app/sales/`) **← Phase 6 신규**
```
✅ Phase 6 완료:
- salehistorytable.tsx: 거래번호 그룹화 (380줄)
- SaleDetailModal.tsx: 상세 모달 (210줄)
- app/sales/actions.ts: getSalesHistory() 필드 매핑 수정
- salegrid.tsx: try-catch 에러 처리 추가

재사용된 패턴 (입고와 동일):
- SaleGroup 인터페이스 (PurchaseGroup과 동일)
- 날짜 필터 UI (입고와 동일)
- 반응형 레이아웃 (입고와 동일)
```

### 재고 조정 (`app/inventory-adjustments/`)
```
✅ 완료:
- AdjustmentForm.tsx: INCREASE/DECREASE 선택
- AdjustmentHistoryTable.tsx: 조정 내역 테이블
- AdjustmentStats.tsx: 통계 카드
- app/inventory-adjustments/actions.ts: 6개 함수
```

---

## 🚀 테스트 체크리스트

### Phase 6.5 검증 사항 (신규)

#### A. 카테고리 관리
- [ ] `/admin/categories` 페이지 접근 (시스템 관리자)
- [ ] 카테고리 목록 조회 (코드, 이름, 품목 수)
- [ ] 카테고리 추가 (코드 중복 체크)
- [ ] 카테고리 수정 (이름 변경)
- [ ] 카테고리 삭제 (품목 없을 때만)
- [ ] 사용 중인 카테고리 삭제 방지

#### B. 레포트 카테고리 필터
- [ ] 구매 레포트 → 카테고리 드롭다운 표시
- [ ] 판매 레포트 → 카테고리 선택 가능
- [ ] 종합 레포트 → 카테고리 필터 적용
- [ ] 재료비 레포트 → 카테고리 필터 적용
- [ ] "전체 카테고리" 선택 시 전체 데이터 표시
- [ ] 특정 카테고리 선택 시 해당 품목만 표시

#### C. 레포트 데이터 정확성
- [ ] 평균 단가 정상 표시 (`avg_unit_cost`, `avg_unit_price`)
- [ ] 품목 수 정상 표시 (`unique_products`)
- [ ] 카테고리 필터링 정확성

#### D. 재고 페이지 검증 (긴급 패치)
- [ ] `/inventory` 페이지 접근
- [ ] 카테고리 컬럼 정상 표시
- [ ] 카테고리 없는 품목 → "미분류" 표시
- [ ] 재고 수량, 평균 단가 정상 표시

### Phase 6 검증 사항 (기존)

#### A. 판매 내역 그룹화
- [ ] 판매 목록 페이지 접근 → 거래번호별 그룹화 확인
- [ ] 날짜 필터 동작 (시작일/종료일 입력)
- [ ] 빠른 선택 (오늘/이번주/이번달) 동작
- [ ] 상세 모달 열기 → 품목별 금액 확인
- [ ] 반응형: 모바일/테블릿 화면에서 정상 표시

#### B. 판매 금액 정확성
- [ ] 판매액이 0원이 아닌 정상 금액 표시
- [ ] 부가세 포함 checkbox 표시 (O/X)
- [ ] 이익 계산 정확성

#### C. 입고 부가세 로직
- [ ] **부가세 포함** 체크 → 단가 11,000 입력
  - [ ] 공급가: 10,000
  - [ ] 부가세: 1,000
  - [ ] 합계: 11,000
  - [ ] 재고 저장: 11,000

- [ ] **부가세 미포함** 체크 → 단가 10,000 입력
  - [ ] 공급가: 10,000
  - [ ] 부가세: 1,000
  - [ ] 합계: 11,000
  - [ ] 재고 저장: 11,000 (✅ 자동 변환)

#### D. 시스템 통합 테스트
- [ ] 입고 → 재고 증가 → 판매 → 재고 감소 (FIFO)
- [ ] 판매 원가 정확성 (FIFO 적용)
- [ ] 재고 조정 (INCREASE/DECREASE)
- [ ] 조정 취소 (당일만 가능)

---

## 📂 핵심 파일 위치

### 데이터베이스
```
database/
├── product_categories_rpc.sql           ← 카테고리 관리 RPC 5개 (신규)
├── add_category_filter_to_reports.sql   ← 레포트 RPC 카테고리 필터 추가 (신규)
├── get_current_inventory_fix.sql        ← 재고 조회 RPC 수정 (신규, 2025-12-09)
├── purchases_sales_rpc_functions.sql    ← get_sales_list 수정
├── phase5_inventory_adjustments_schema.sql
└── complete_schema.sql                  ← 전체 스키마 통합
```

### 카테고리 관리 (신규)
```
app/admin/categories/
├── page.tsx                             ← 카테고리 관리 페이지
└── actions.ts                           ← Server Actions (CRUD)

components/admin/categories/
├── CategoryManagement.tsx               ← 메인 컨테이너
├── CategoryTable.tsx                    ← 목록 테이블
└── CategoryForm.tsx                     ← 추가/수정 폼
```

### 레포트 (카테고리 필터 추가)
```
app/reports/
├── profit/
│   ├── ProfitReportClient.tsx         ← 카테고리 상태 + 필터
│   └── actions.ts                     ← p_category_id 추가
├── purchases/
│   ├── PurchaseReportClient.tsx       ← 카테고리 상태 + 필터
│   └── actions.ts                     ← p_category_id 추가 + 매핑 수정 ✅
├── sales/
│   ├── SalesReportClient.tsx          ← 카테고리 상태 + 필터
│   └── actions.ts                     ← p_category_id 추가 + 매핑 수정 ✅
└── usage/
    ├── UsageReportClient.tsx          ← 카테고리 상태 + 필터
    └── actions.ts                     ← p_category_id 추가

components/reports/
└── ReportFilters.tsx                  ← 카테고리 드롭다운 UI 추가
```

### 프론트엔드 (판매)
```
app/sales/
├── page.tsx                            ← 서버 컴포넌트
└── actions.ts                          ← getSalesHistory() 수정

components/sales/
├── salehistorytable.tsx               ← 거래번호 그룹화 (신규)
├── SaleDetailModal.tsx                ← 상세 모달 (신규)
├── salegrid.tsx                       ← try-catch 추가
└── ...

types/
└── sales.ts                           ← SaleGroup 인터페이스
```

### 프론트엔드 (입고)
```
components/purchases/
├── PurchaseGrid.tsx                   ← calculatePrices() 개선 (2025-12-04)
├── PurchaseForm.tsx
└── ...
```

---

## 🔍 주요 버그 수정 이력

### Phase 6.5 개선 사항 (2025-12-09)

#### 7. 입고/판매 거래처 필수 선택 제거 (Phase 6.5-3) **← 최신**
**요구사항**: 고객(거래처) 선택 없이도 입고 및 판매 가능하도록 변경
**변경 내용**:
1. **프론트엔드 검증 제거**
   - `PurchaseForm.tsx`: 공급업체 필수 검증 제거
   - `SaleForm.tsx`: 고객 필수 검증 제거
   
2. **Server Actions 검증 제거**
   - `app/purchases/actions.ts`: supplier_id 필수 검증 제거
   - `app/sales/actions.ts`: customer_id 필수 검증 제거

3. **타입 정의 수정**
   - `types/purchases.ts`: `supplier_id: string | null`
   - `types/sales.ts`: `customer_id: string | null`

**영향**:
- 입고 시 공급업체를 선택하지 않아도 입고 처리 가능
- 판매 시 고객을 선택하지 않아도 판매 처리 가능
- null 값으로 DB에 저장됨

**수정 파일**: 6개
- `components/purchases/PurchaseForm.tsx`
- `components/sales/SaleForm.tsx`
- `app/purchases/actions.ts`
- `app/sales/actions.ts`
- `types/purchases.ts`
- `types/sales.ts`

---

### Phase 6.5 버그 수정 (2025-12-09)

#### 6. 재고 페이지 카테고리 조회 오류 (Phase 6.5-2)
**원인**: `get_current_inventory` 함수에서 `p.category` 컬럼 직접 참조
- 기존: `p.category` (VARCHAR) - 존재하지 않는 컬럼
- products 테이블: `category_id` (UUID) - 실제 컬럼

**해결**: product_categories 테이블 JOIN 추가
```sql
-- ✅ 수정 후
LEFT JOIN product_categories pc ON p.category_id = pc.id
...
COALESCE(pc.name, '미분류')::VARCHAR AS category
```

**파일**: `database/inventory_rpc_functions.sql` (또는 해당 RPC 파일)

**영향**: 재고 페이지에서 카테고리명이 정상적으로 표시됨

---

#### 5. 레포트 데이터 매핑 불일치 (Phase 6.5-1)
**원인**: DB 컬럼명과 TypeScript 매핑 불일치
- DB: `avg_unit_cost`, `avg_unit_price`, `unique_products`
- 기존 매핑: `average_unit_cost`, `average_unit_price`, `product_count`

**해결**: Server Actions에서 DB 컬럼명 그대로 사용
```typescript
// ✅ 수정 후 (구매 레포트)
average_unit_cost: parseFloat(item.avg_unit_cost) || 0,
product_count: parseInt(item.unique_products, 10) || 0,

// ✅ 수정 후 (판매 레포트)
average_unit_price: parseFloat(item.avg_unit_price) || 0,
product_count: parseInt(item.unique_products, 10) || 0,
```

**파일**: 
- `app/reports/purchases/actions.ts`
- `app/reports/sales/actions.ts`

**영향**: 레포트 페이지에서 평균 단가 및 품목 수가 정상적으로 표시됨

---

### Phase 6 버그 수정 (2025-12-04)

#### 1. 판매 금액 0원 표시 (Phase 6-1)
**원인**: RPC 함수에서 `total_price`를 반환했는데 앱이 `total_amount` 필드 기대  
**해결**: RPC 함수에 `s.total_price AS total_amount` 별칭 추가  
**파일**: `database/purchases_sales_rpc_functions.sql`

#### 2. RPC 함수 타입 불일치 (Phase 6-2)
**원인**: VARCHAR 필드를 TEXT로, INTEGER를 NUMERIC으로 캐스팅하지 않음  
**해결**: 모든 필드에 명시적 타입 캐스팅 추가  
**파일**: `database/purchases_sales_rpc_functions.sql`

#### 3. AG Grid 파괴 에러 (Phase 6-3)
**원인**: Grid 언마운트 중 비동기 `refreshCells()` 호출  
**해결**: try-catch로 에러 무시  
**파일**: `components/sales/salegrid.tsx`

#### 4. 부가세 미포함 단가 미변환 (Phase 6-4)
**원인**: 부가세 미포함 시 입력 단가를 그대로 저장 (부가세 포함 아님)  
**해결**: `row.unit_cost = Math.round(inputUnitCost * 1.1)` 추가  
**파일**: `components/purchases/PurchaseGrid.tsx`

---

## 🎯 다음 Phase 계획 (Phase 7+)

### Phase 7: 보고서 및 분석 (예상)
- [ ] 판매 보고서 (일자별/거래처별)
- [ ] 입고 보고서 (공급업체별)
- [ ] 재고 현황 보고서 (품목별/지점별)
- [ ] 원가 분석 (FIFO 원가 vs 판매가)
- [ ] 손익 계산서

### Phase 8: 추가 기능 (예상)
- [ ] 선주문 관리
- [ ] 예산 관리
- [ ] 가격표 관리
- [ ] 배송 추적

---

## 💾 배포 및 유지보수

### 데이터베이스 업데이트 절차
1. `database/` 폴더의 SQL 스크립트 확인
2. Supabase SQL Editor에서 실행
3. 타입 재생성: `supabase gen types typescript --local > types/supabase.ts`
4. Next.js 재시작

### 코드 배포
1. 모든 파일 변경사항 확인
2. `npm run build` → 빌드 에러 확인
3. `npm run lint` → 스타일 체크
4. Git commit & push
5. 프로덕션 배포

### 주의사항
- **RPC 함수 수정 시**: 파라미터 타입 (TEXT 필수), 반환 타입 (TEXT 필수) 확인
- **필드 매핑**: ⚠️ **DB 컬럼명을 그대로 사용** (Phase 6.5-1 참고)
  - DB: `avg_unit_cost` → TS: `item.avg_unit_cost` ✅
  - DB: `unique_products` → TS: `item.unique_products` ✅
- **Type 캐스팅**: `::TEXT`, `::NUMERIC`, `::UUID` 명시적 사용
- **에러 처리**: Grid 관련 에러는 try-catch로 무시 (정상 동작)
- **카테고리 필터**: RPC 함수에 `p_category_id` 파라미터, products 테이블 조인 필수

---

## 📚 참고 자료

| 문서 | 용도 |
|------|------|
| `.github/copilot-instructions.md` | 프로젝트 아키텍처 가이드 |
| `DATABASE_HANDOVER.md` | Phase 0-4 DB 설계 문서 |
| `PHASE5_HANDOVER.md` | Phase 5 재고 조정 상세 |
| `database/CATEGORY_MANAGEMENT_COMPLETE.md` | Phase 6.5 카테고리 관리 완료 보고서 |
| `database/README.md` | DB 스키마 및 RPC 함수 설명 |
| `docs/DEVELOPMENT_LESSONS.md` | Phase 3.5 교훈 (트리거 제거) |
| `docs/NEXT_TASKS.md` | 향후 작업 우선순위 |

---

## 📞 다음 세션 시작 방법

### 1. 현재 상태 확인
```bash
# 1. 프로젝트 시작
npm run dev

# 2. 판매 목록 확인 (http://localhost:3000/sales)
# 3. 입고 목록 확인 (http://localhost:3000/purchases)
# 4. 콘솔 에러 확인
```

### 2. 테스트 진행
- 위 "테스트 체크리스트" 참고
- 발견된 버그 기록

### 3. 다음 작업 결정
- 추가 기능 개선 (예: 보고서)
- 버그 수정
- Phase 7 시작

---

## 📝 변경 파일 총 개수

### Phase 6.5 (2025-12-09)
- **데이터베이스**: 3개 (product_categories_rpc.sql, add_category_filter_to_reports.sql, get_current_inventory_fix.sql)
- **타입 정의**: 4개 (permissions.ts, reports.ts, purchases.ts, sales.ts)
- **카테고리 관리**: 5개 (page, actions, 3개 컴포넌트)
- **레포트 Actions**: 4개 (수정: profit, purchases, sales, usage)
- **레포트 클라이언트**: 4개 (수정: 4개 레포트 페이지)
- **입고/판매 개선**: 4개 (PurchaseForm.tsx, SaleForm.tsx, purchases/actions.ts, sales/actions.ts)
- **공통 컴포넌트**: 2개 (Navigation.tsx, ReportFilters.tsx)
- **문서**: 1개 (CATEGORY_MANAGEMENT_COMPLETE.md)
- **총 변경 파일**: **27개**

### Phase 6 (2025-12-04)
- **데이터베이스**: 1개
- **타입 정의**: 1개
- **판매 컴포넌트**: 3개
- **입고 컴포넌트**: 1개
- **Actions**: 1개
- **총 변경 파일**: **7개**

**전체 누적**: **28개 파일**

---

**마지막 업데이트**: Phase 6.5 완료 (2025-12-09)  
**상태**: ✅ 카테고리 관리 구현 완료, 레포트 필터 추가 완료, 데이터 매핑 버그 수정 완료, 재고 페이지 카테고리 조회 오류 수정 완료  
**다음 작업**: Phase 7 기획 및 개발

---

## 🐛 긴급 패치 이력

### 2025-12-09 오후
- ⚠️ **재고 페이지 오류 발견**: 카테고리 컬럼 조회 실패
- ✅ **즉시 수정**: `get_current_inventory` RPC 함수 수정
- 📝 **SQL 파일 생성**: `database/get_current_inventory_fix.sql`
- 🎯 **결과**: 재고 페이지 정상 작동 확인

