# 🎯 향후 작업 계획

## 작성일: 2025-01-26
## 상태: 계획 수립 완료 (코드 작성 전)

---

# 📋 작업 1: 시스템 관리자 전 지점 레포트 조회

## 🎯 목적
시스템 관리자가 레포트 페이지에서 **전체 지점** 또는 **특정 지점**을 선택하여 조회할 수 있도록 개선

## 📌 비즈니스 규칙

| 역할 | 지점 선택 | 조회 범위 |
|------|----------|----------|
| **시스템 관리자 (0000)** | ✅ 가능 (전체/강남/분당/...) | 선택한 지점 또는 전체 |
| **원장 (0001)** | ❌ 불가능 (고정) | 본인 지점만 |
| **매니저 (0002)** | ❌ 불가능 (고정) | 본인 지점만 |
| **사용자 (0003)** | ❌ 불가능 (고정) | 본인 지점만 |

---

## 🔧 수정 범위

### 1. 데이터베이스 (수정 불필요)
- ✅ 기존 RPC 함수들이 이미 `p_branch_id` 파라미터를 지원함
- ✅ `p_branch_id = NULL` → 전체 지점
- ✅ `p_branch_id = UUID` → 특정 지점

**예시**: `get_sales_report`, `get_purchase_report`, `get_summary_report`

---

### 2. Server Actions (수정 불필요)
- ✅ 기존 Actions가 이미 `branchId` 파라미터를 RPC에 전달함
- 예: `getSalesReport(filter)` → `p_branch_id: filter.branchId`

---

### 3. 클라이언트 컴포넌트 (수정 필요)

#### 수정할 파일:
- `app/reports/sales/SalesReportClient.tsx`
- `app/reports/purchases/PurchasesReportClient.tsx`
- `app/reports/usage/UsageReportClient.tsx`
- `app/reports/profit/ProfitReportClient.tsx`

#### 수정 내용:
```tsx
// 기존
<ReportFilters
  showBranchFilter={userSession.role === '0000'}  // ✅ 이미 조건부로 표시 중
  branches={[]}  // ❌ 빈 배열 (지점 목록 없음)
/>

// 수정
<ReportFilters
  showBranchFilter={userSession.role === '0000'}
  branches={branches}  // ✅ 실제 지점 목록 전달
/>
```

#### 추가 작업:
1. `useEffect`에서 지점 목록 조회
2. `getBranches()` 함수 호출 (이미 존재)
3. 지점 선택 드롭다운 활성화

---

### 4. ReportFilters 컴포넌트 (확인 필요)

**파일**: `components/reports/ReportFilters.tsx`

#### 확인사항:
- `branches` prop을 받아서 지점 선택 드롭다운을 렌더링하는가?
- 지점 선택 시 `filter.branchId` 업데이트가 제대로 되는가?

---

## 📊 UI 변경

### 시스템 관리자 화면

```
┌─────────────────────────────────────────┐
│ 📊 종합 레포트                          │
├─────────────────────────────────────────┤
│ 필터                                    │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│ │ 시작일   │ │ 종료일   │ │  지점     │  │
│ └─────────┘ └─────────┘ │  ▼        │  │
│                          │ ○ 전체 지점│  │ ← 추가!
│                          │ ○ 강남점   │  │
│                          │ ○ 분당점   │  │
│                          └──────────┘  │
└─────────────────────────────────────────┘
```

### 일반 사용자 화면 (원장/매니저/사용자)

```
┌─────────────────────────────────────────┐
│ 📊 종합 레포트                          │
├─────────────────────────────────────────┤
│ 필터                                    │
│ ┌─────────┐ ┌─────────┐               │
│ │ 시작일   │ │ 종료일   │               │
│ └─────────┘ └─────────┘               │
│                                         │
│ 지점: 강남점 (고정)                     │ ← 변경 불가
└─────────────────────────────────────────┘
```

---

## 📋 수정 체크리스트

### 클라이언트 컴포넌트 (4개 파일)

- [ ] `SalesReportClient.tsx`
  - [ ] `useState<Branch[]>([])` 추가
  - [ ] `useEffect`에서 `getBranches()` 호출
  - [ ] `branches` prop 전달

- [ ] `PurchasesReportClient.tsx`
  - [ ] 동일한 수정

- [ ] `UsageReportClient.tsx`
  - [ ] 동일한 수정

- [ ] `ProfitReportClient.tsx`
  - [ ] 동일한 수정

### 공통 패턴

```tsx
export default function XxxReportClient({ userSession }: Props) {
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    // 시스템 관리자만 지점 목록 조회
    if (userSession.role === '0000') {
      const fetchBranches = async () => {
        const { data } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        setBranches(data || [])
      }
      fetchBranches()
    }
  }, [userSession.role])

  return (
    <ReportFilters
      showBranchFilter={userSession.role === '0000'}
      branches={branches}  // ✅ 실제 데이터 전달
      onFilterChange={handleFilterChange}
    />
  )
}
```

---

# 📋 작업 2: 품목 카테고리 정규화

## 🎯 목적
품목 카테고리를 별도 테이블로 관리하여 **카테고리별 필터링** 및 **일관성** 확보

---

## 📊 현재 상태

### products 테이블 (현재)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  code TEXT,
  name TEXT,
  category TEXT,  -- ❌ 자유 입력 (오타, 중복 가능)
  unit TEXT,
  ...
);
```

**문제점**:
- "화장품", "화장품류", "cosmetics" → 중복/오타
- 카테고리 목록 관리 불가
- 필터링 시 정확도 낮음

---

## 🔧 수정 계획

### 1. 새 테이블 생성: `product_categories`

```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,  -- 예: 'COSMETIC', 'MEDICAL'
  name VARCHAR(50) NOT NULL,          -- 예: '화장품', '의료소모품'
  description TEXT,                   -- 설명
  display_order INT DEFAULT 0,        -- 표시 순서
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO product_categories (code, name, display_order) VALUES
  ('COSMETIC', '화장품', 1),
  ('MEDICAL', '의료소모품', 2),
  ('SUPPLEMENT', '건강기능식품', 3),
  ('DEVICE', '의료기기', 4),
  ('ETC', '기타', 99);
```

---

### 2. products 테이블 수정

```sql
-- category 컬럼 타입 변경 (TEXT → UUID)
ALTER TABLE products RENAME COLUMN category TO category_old;

ALTER TABLE products ADD COLUMN category_id UUID 
  REFERENCES product_categories(id);

-- 기존 데이터 마이그레이션
UPDATE products p
SET category_id = (
  SELECT id FROM product_categories 
  WHERE name = p.category_old
  LIMIT 1
);

-- 외래키 제약 조건
ALTER TABLE products 
  ADD CONSTRAINT fk_products_category 
  FOREIGN KEY (category_id) 
  REFERENCES product_categories(id);

-- 기존 컬럼 삭제 (옵션)
-- ALTER TABLE products DROP COLUMN category_old;
```

---

### 3. RPC 함수 수정

#### `get_products_list` 함수 수정

```sql
-- 기존
SELECT 
  p.id,
  p.code,
  p.name,
  p.category,  -- TEXT
  ...
FROM products p;

-- 수정
SELECT 
  p.id,
  p.code,
  p.name,
  p.category_id,
  pc.code AS category_code,
  pc.name AS category_name,  -- 카테고리명
  ...
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id;
```

---

### 4. TypeScript 타입 수정

**파일**: `types/products.ts`

```typescript
// 카테고리 타입 추가
export interface ProductCategory {
  id: string
  code: string
  name: string
  description?: string
  display_order: number
  is_active: boolean
}

// Product 타입 수정
export interface Product {
  id: string
  code: string
  name: string
  category_id: string        // ✅ 추가
  category_code?: string     // ✅ 추가
  category_name?: string     // ✅ 추가 (조인 결과)
  // category: string        // ❌ 삭제 (또는 deprecated)
  unit: string
  ...
}
```

---

### 5. 품목 입력 폼 수정

**파일**: `components/products/ProductForm.tsx`

#### 기존 (자유 입력)
```tsx
<FormField label="카테고리">
  <Input
    type="text"
    value={formData.category}
    onChange={(e) => setFormData({...formData, category: e.target.value})}
  />
</FormField>
```

#### 수정 (드롭다운 선택)
```tsx
<FormField label="카테고리" required>
  <select
    value={formData.category_id}
    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
    className="..."
  >
    <option value="">선택하세요</option>
    {categories.map((cat) => (
      <option key={cat.id} value={cat.id}>
        {cat.name}
      </option>
    ))}
  </select>
</FormField>
```

---

### 6. 레포트에 카테고리 필터 추가

#### UI 변경

```tsx
// 레포트 필터에 카테고리 선택 추가
<div>
  <label>카테고리</label>
  <select
    value={selectedCategoryId}
    onChange={(e) => setSelectedCategoryId(e.target.value)}
  >
    <option value="">전체 카테고리</option>
    {categories.map((cat) => (
      <option key={cat.id} value={cat.id}>
        {cat.name}
      </option>
    ))}
  </select>
</div>
```

#### RPC 함수 수정

```sql
-- get_sales_report에 카테고리 필터 추가
CREATE OR REPLACE FUNCTION get_sales_report(
  ...,
  p_category_id TEXT DEFAULT NULL  -- ✅ 추가
)
...
WHERE 
  ...
  AND (p_category_id IS NULL OR p.category_id::TEXT = p_category_id)
```

---

## 📂 수정할 파일 목록

### 작업 1: 시스템 관리자 전 지점 레포트

| 파일 | 수정 내용 |
|------|----------|
| `database/fix_admin_login.sql` | verify_login 함수 수정 (이미 작성됨) |
| `app/reports/sales/SalesReportClient.tsx` | 지점 목록 조회 및 전달 |
| `app/reports/purchases/PurchasesReportClient.tsx` | 지점 목록 조회 및 전달 |
| `app/reports/usage/UsageReportClient.tsx` | 지점 목록 조회 및 전달 |
| `app/reports/profit/ProfitReportClient.tsx` | 지점 목록 조회 및 전달 |
| `components/reports/ReportFilters.tsx` | 지점 드롭다운 UI 확인 |

**예상 코드량**: ~100줄 (4개 파일 × 25줄)

---

### 작업 2: 품목 카테고리 정규화

| 파일 | 수정 내용 |
|------|----------|
| `database/create_product_categories.sql` | 카테고리 테이블 생성, 초기 데이터 |
| `database/migrate_product_category.sql` | products 테이블 마이그레이션 |
| `database/products_rpc_functions.sql` | get_products_list 함수 수정 (조인 추가) |
| `types/products.ts` | ProductCategory 타입 추가, Product 수정 |
| `components/products/ProductForm.tsx` | 드롭다운 UI로 변경 |
| `components/products/ProductManagement.tsx` | 카테고리 목록 조회 및 전달 |
| `app/reports/*/actions.ts` | 카테고리 필터 지원 (4개 파일) |
| `components/reports/ReportFilters.tsx` | 카테고리 필터 UI 추가 |

**예상 코드량**: ~500줄 (DB 마이그레이션 포함)

---

## 🎯 작업 우선순위

### 우선순위 1: 시스템 관리자 전 지점 레포트 (즉시 가능)
- ✅ DB 수정 불필요
- ✅ 클라이언트 컴포넌트만 수정
- ✅ 예상 소요 시간: 30분
- ✅ 영향 범위: 작음 (레포트 페이지만)

### 우선순위 2: 품목 카테고리 정규화 (신중 필요)
- ⚠️ DB 스키마 변경 (마이그레이션 필요)
- ⚠️ 기존 데이터 변환 필요
- ⚠️ 예상 소요 시간: 2시간
- ⚠️ 영향 범위: 큼 (품목 관리, 레포트 전체)

---

## 📊 작업 1 상세 계획

### 목표
시스템 관리자가 레포트에서 지점을 선택할 수 있도록

### 수정 패턴 (4개 레포트 동일)

```tsx
// 1. State 추가
const [branches, setBranches] = useState<{id: string, name: string}[]>([])

// 2. 지점 목록 조회 (시스템 관리자만)
useEffect(() => {
  if (userSession.role === '0000') {
    const fetchBranches = async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      setBranches(data || [])
    }
    fetchBranches()
  }
}, [userSession.role])

// 3. ReportFilters에 전달
<ReportFilters
  showBranchFilter={userSession.role === '0000'}
  branches={branches}  // ✅ 실제 데이터
  onFilterChange={handleFilterChange}
/>
```

### 테스트 시나리오

| 역할 | 지점 선택 | 조회 결과 |
|------|----------|----------|
| admin | "전체 지점" | 모든 지점 데이터 |
| admin | "강남점" | 강남점만 |
| 원장 (강남) | (선택 불가) | 강남점만 |

---

## 📊 작업 2 상세 계획

### 목표
카테고리를 정규화하여 드롭다운 선택 및 필터링 지원

### 단계별 작업

#### Phase 1: 카테고리 테이블 생성
```sql
1. product_categories 테이블 생성
2. 초기 카테고리 데이터 INSERT
3. 권한 설정
```

#### Phase 2: products 테이블 마이그레이션
```sql
1. category_id 컬럼 추가
2. 기존 category 데이터 매핑
3. 외래키 제약 조건 추가
4. category_old 컬럼 삭제 (백업 후)
```

#### Phase 3: RPC 함수 수정
```sql
1. get_products_list: product_categories 조인
2. create_product: category_id 파라미터
3. update_product: category_id 파라미터
```

#### Phase 4: 프론트엔드 수정
```tsx
1. ProductCategory 타입 추가
2. Product 타입에 category_id 추가
3. ProductForm에 카테고리 드롭다운
4. ProductManagement에서 카테고리 목록 조회
```

#### Phase 5: 레포트 필터 추가
```tsx
1. ReportFilters에 카테고리 선택 추가
2. RPC 함수에 p_category_id 파라미터
3. 카테고리별 집계 기능
```

---

## 🚨 주의사항

### 작업 1 (시스템 관리자 지점 선택)
- ✅ 저위험: 기존 기능 영향 없음
- ✅ 빠른 적용 가능
- ✅ 롤백 쉬움

### 작업 2 (카테고리 정규화)
- ⚠️ 고위험: DB 스키마 변경
- ⚠️ 기존 데이터 마이그레이션 필요
- ⚠️ 충분한 테스트 필요
- ⚠️ 백업 필수

**권장**: 작업 1을 먼저 완료하고, 작업 2는 별도 세션에서 진행

---

## 📌 예상 카테고리 목록

| code | name | display_order |
|------|------|---------------|
| COSMETIC | 화장품 | 1 |
| MEDICAL | 의료소모품 | 2 |
| SUPPLEMENT | 건강기능식품 | 3 |
| DEVICE | 의료기기 | 4 |
| MEDICINE | 의약품 | 5 |
| REAGENT | 시약 | 6 |
| ETC | 기타 | 99 |

---

## 🎯 다음 단계

### 즉시 작업 가능:
1. ✅ `database/fix_admin_login.sql` 실행
2. ✅ 작업 1 (시스템 관리자 지점 선택) 구현

### 별도 계획 필요:
3. ⏳ 작업 2 (카테고리 정규화) - 상세 설계 후 진행

---

**작성일**: 2025-01-26  
**상태**: 계획 수립 완료  
**다음 작업**: 작업 1 구현 또는 작업 2 상세 설계

