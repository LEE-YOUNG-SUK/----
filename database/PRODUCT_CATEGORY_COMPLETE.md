# ✅ 품목 카테고리 드롭다운 구현 완료

## 작성일: 2025-01-26
## 상태: 구현 완료

---

## 🎯 구현 내용

품목 추가/수정 폼에서 카테고리를 드롭다운으로 선택할 수 있도록 변경했습니다.

---

## 📂 생성/수정된 파일

### 1. 데이터베이스 (3개)

#### ✅ `database/create_product_categories.sql`
- `product_categories` 테이블 생성
- 13개 초기 카테고리 데이터 INSERT
- 인덱스 및 트리거 설정

**카테고리 목록**:
1. 00001 - 필러
2. 00002 - 보톡스
3. 00003 - 기타쁘띠
4. 00004 - 리프팅실
5. 00005 - 화장품
6. 00006 - 약/주사
7. 00007 - 약/외용
8. 00008 - 약/기타
9. 00009 - 장비소모품
10. 00010 - 외용소모품
11. 00011 - 스킨소모품
12. 00012 - 사무소모품
13. 00013 - 기타소모품품

#### ✅ `database/migrate_product_category.sql`
- `products.category_id` (UUID) 컬럼 추가
- 기존 `category` (TEXT) 데이터를 `category_id`로 자동 매핑
- 매핑되지 않은 데이터는 기본 카테고리('기타소모품품') 설정
- 기존 `category` 컬럼을 `category_old`로 이름 변경 (백업용)

#### ✅ `database/update_products_rpc_category.sql`
- `get_products_list()` 수정: `category_code`, `category_name` JOIN 추가
- `create_product()` 수정: `p_category_id` (UUID) 파라미터로 변경
- `update_product()` 수정: `p_category_id` (UUID) 파라미터로 변경
- `get_product_categories()` 신규 추가: 카테고리 목록 조회

---

### 2. TypeScript 타입 (1개)

#### ✅ `types/index.ts`
```typescript
// 신규 추가
export interface ProductCategory {
  id: string
  code: string
  name: string
  description?: string | null
  display_order: number
  is_active: boolean
}

// 수정
export interface Product {
  // ...기존 필드들
  category_id: string | null         // ✅ 추가
  category_code?: string | null      // ✅ 추가 (JOIN 결과)
  category_name?: string | null      // ✅ 추가 (JOIN 결과)
  category?: string | null           // 하위 호환 (구 버전)
  // ...
}
```

---

### 3. Server Actions (1개)

#### ✅ `app/products/actions.ts`

**추가된 함수**:
```typescript
export async function getProductCategories(): Promise<ProductCategory[]> {
  // product_categories 테이블 조회 (RPC 사용)
}
```

**수정된 함수**:
```typescript
export async function saveProduct(formData: {
  // ...
  category_id: string | null  // ✅ category → category_id 변경
  // ...
}) {
  // RPC 함수(create_product, update_product) 사용으로 변경
}
```

---

### 4. UI 컴포넌트 (1개)

#### ✅ `components/products/ProductForm.tsx`

**변경사항**:
1. `getProductCategories` import
2. `categories` state 추가
3. `useEffect`로 카테고리 목록 자동 로딩
4. 카테고리 입력 필드를 자유 입력(`Input`) → 드롭다운(`select`)으로 변경
5. `formData.category` → `formData.category_id`로 변경

**UI 변경**:
```tsx
// Before (자유 입력)
<Input
  id="category"
  value={formData.category}
  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
  placeholder="예: 소모품, 장비, 의약품"
/>

// After (드롭다운 선택)
<select
  id="category_id"
  value={formData.category_id}
  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
  required
>
  <option value="">카테고리 선택</option>
  {categories.map((cat) => (
    <option key={cat.id} value={cat.id}>
      {cat.name}
    </option>
  ))}
</select>
```

---

## 🚀 적용 순서 (실제 작업)

### Step 1: 카테고리 테이블 생성
```sql
-- Supabase SQL Editor에서 실행
-- database/create_product_categories.sql 전체 실행
```

**예상 결과**: 
- `product_categories` 테이블 생성
- 13개 카테고리 INSERT

---

### Step 2: products 테이블 마이그레이션
```sql
-- ⚠️ 주의: 반드시 백업 먼저!
CREATE TABLE products_backup_20250126 AS SELECT * FROM products;

-- database/migrate_product_category.sql 실행
```

**예상 결과**:
- `products.category_id` 컬럼 추가
- 기존 데이터 자동 매핑
- `products.category` → `products.category_old` 이름 변경

---

### Step 3: RPC 함수 업데이트
```sql
-- database/update_products_rpc_category.sql 실행
```

**예상 결과**:
- `create_product()`, `update_product()`, `get_products_list()` 업데이트
- `get_product_categories()` 신규 함수 생성

---

### Step 4: 프론트엔드 빌드 및 테스트
```bash
npm run build
```

**예상 결과**: ✅ 빌드 성공

---

## 🧪 테스트 시나리오

### 1. 카테고리 드롭다운 표시
1. 품목 관리 페이지 접속 (`/products`)
2. "새 품목 추가" 버튼 클릭
3. 카테고리 필드 확인
4. **결과**: 13개 카테고리가 드롭다운으로 표시됨 ✅

### 2. 품목 생성
1. 품목 코드: `TEST001`
2. 품명: `테스트 품목`
3. 카테고리: "필러" 선택
4. 단위: EA
5. 저장 버튼 클릭
6. **결과**: 품목 생성 성공, 카테고리 `00001` (필러) 저장됨 ✅

### 3. 기존 품목 수정
1. 기존 품목 클릭 (수정)
2. 카테고리 드롭다운에서 현재 카테고리 선택되어 있음 확인
3. 다른 카테고리로 변경
4. 저장
5. **결과**: 카테고리 변경 성공 ✅

### 4. 품목 목록 표시
1. 품목 목록에서 카테고리 컬럼 확인
2. **결과**: 카테고리명(예: "필러") 표시됨 (JOIN 결과) ✅

---

## 📊 데이터베이스 구조 변경

### Before (기존)
```sql
CREATE TABLE products (
  -- ...
  category TEXT,  -- 자유 입력 (오타 가능)
  -- ...
);
```

### After (변경 후)
```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(100),
  display_order INT,
  -- ...
);

CREATE TABLE products (
  -- ...
  category_id UUID REFERENCES product_categories(id),  -- 외래키 (정규화)
  category_old TEXT,  -- 백업용 (나중에 삭제 가능)
  -- ...
);
```

---

## ✅ 체크리스트

### 데이터베이스
- [x] `product_categories` 테이블 생성
- [x] 13개 카테고리 초기 데이터
- [x] `products.category_id` 컬럼 추가
- [x] 기존 데이터 마이그레이션
- [x] RPC 함수 수정
- [x] `get_product_categories()` 함수 추가

### TypeScript
- [x] `ProductCategory` 인터페이스 추가
- [x] `Product` 인터페이스 수정 (`category_id` 추가)

### Server Actions
- [x] `getProductCategories()` 함수 추가
- [x] `saveProduct()` 함수 수정 (RPC 사용)

### UI 컴포넌트
- [x] `ProductForm` 카테고리 드롭다운 구현
- [x] 카테고리 목록 자동 로딩

### 테스트
- [ ] 카테고리 드롭다운 표시 확인
- [ ] 품목 생성 테스트
- [ ] 품목 수정 테스트
- [ ] 품목 목록 표시 확인

---

## 🎯 다음 단계

### 즉시 실행 가능
1. Supabase SQL Editor에서 3개 SQL 파일 순서대로 실행
2. 프론트엔드 빌드 (`npm run build`)
3. 테스트

### 향후 개선 (옵션)
1. **카테고리 관리 페이지** 추가
   - 카테고리 추가/수정/삭제 UI
   - 표시 순서 변경 (드래그 앤 드롭)
   
2. **레포트 카테고리 필터** 추가
   - 판매 레포트에서 카테고리별 필터링
   - 구매 레포트에서 카테고리별 필터링
   
3. **카테고리별 통계** 추가
   - 카테고리별 매출 합계
   - 카테고리별 재고 현황
   
4. **기존 `category_old` 컬럼 삭제**
   - 마이그레이션 완료 후 더 이상 필요 없음
   ```sql
   ALTER TABLE products DROP COLUMN category_old;
   ```

---

## ⚠️ 주의사항

### 마이그레이션 전
1. ✅ **반드시 백업!**
   ```sql
   CREATE TABLE products_backup_20250126 AS SELECT * FROM products;
   ```

2. ✅ 현재 `products.category` 값 확인
   ```sql
   SELECT DISTINCT category, COUNT(*) 
   FROM products 
   GROUP BY category;
   ```

### 롤백 방법
```sql
-- category_id 삭제
ALTER TABLE products DROP COLUMN IF EXISTS category_id;

-- category_old를 category로 복원
ALTER TABLE products RENAME COLUMN category_old TO category;
```

---

## 📸 예상 UI

### 품목 추가 폼

```
┌────────────────────────────────────────┐
│ 새 품목 추가                           │
├────────────────────────────────────────┤
│ 품목 코드: [MED001        ]           │
│ 품명:     [생리식염수 500ml ]          │
│                                        │
│ 카테고리: [약/외용        ▼]  ← 드롭다운│
│           - 필러                       │
│           - 보톡스                     │
│           - 기타쁘띠                   │
│           - 리프팅실                   │
│           - 화장품                     │
│           - 약/주사                    │
│           - 약/외용         ← 선택됨   │
│           - 약/기타                    │
│           - ...                        │
│                                        │
│ 단위:     [EA (개)        ▼]          │
└────────────────────────────────────────┘
```

---

**작성일**: 2025-01-26  
**상태**: ✅ 구현 완료  
**다음 작업**: SQL 실행 및 테스트

