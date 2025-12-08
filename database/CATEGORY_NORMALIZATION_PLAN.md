# 📋 품목 카테고리 정규화 계획

## 작성일: 2025-01-26
## 상태: 계획 수립 완료

---

## 🎯 목적

품목의 **카테고리를 정규화**하여:
1. ✅ 드롭다운으로 선택 (오타 방지)
2. ✅ 카테고리별 필터링 (레포트)
3. ✅ 일관성 확보

---

## 📊 초기 카테고리 목록 (실제 사용 중)

| code | name | display_order | 용도 |
|------|------|---------------|------|
| 00001 | 필러 | 1 | 시술 재료 |
| 00002 | 보톡스 | 2 | 시술 재료 |
| 00003 | 기타뷰티 | 3 | 뷰티 제품 |
| 00004 | 리프팅샵 | 4 | 시술 재료 |
| 00005 | 화장품 | 5 | 화장품 |
| 00006 | 악/주사 | 6 | 의약품 (주사) |
| 00007 | 악/외용 | 7 | 의약품 (외용) |
| 00008 | 악/기타 | 8 | 의약품 (기타) |
| 00009 | 장비스킨룸 | 9 | 장비 |
| 00010 | 외용스킨룸 | 10 | 스킨룸 외용 |
| 00011 | 스킨스킨룸 | 11 | 스킨룸 |
| 00012 | 샤푸스킨룸 | 12 | 스킨룸 샴푸 |
| 00013 | 기타스킨룸 | 13 | 스킨룸 기타 |

**총 13개 카테고리**

---

## 🔧 단계별 작업 계획

### Phase 1: 카테고리 테이블 생성 (즉시 가능)

**파일**: `database/create_product_categories.sql` ✅ (생성 완료)

**작업 내용**:
```sql
1. product_categories 테이블 생성
2. 초기 13개 카테고리 INSERT
3. 인덱스 생성
4. 트리거 설정 (updated_at)
```

**영향**: 없음 (신규 테이블)

---

### Phase 2: products 테이블 마이그레이션 (신중)

**파일**: `database/migrate_product_category.sql` (작성 예정)

#### 2-1. 컬럼 추가
```sql
-- category_id 컬럼 추가
ALTER TABLE products ADD COLUMN category_id UUID 
  REFERENCES product_categories(id);
```

#### 2-2. 기존 데이터 매핑
```sql
-- 방법 1: 수동 매핑 (권장)
-- 기존 products.category(TEXT)와 새 product_categories.name을 수동으로 매핑

-- 방법 2: 자동 매핑 (위험)
UPDATE products p
SET category_id = (
  SELECT id FROM product_categories pc
  WHERE pc.name = p.category
  LIMIT 1
);

-- 방법 3: 기본값 설정 (안전)
-- 매핑 안 되는 품목은 '기타뷰티' 또는 '기타스킨룸'으로 설정
UPDATE products
SET category_id = (SELECT id FROM product_categories WHERE code = '00003')
WHERE category_id IS NULL;
```

#### 2-3. 제약 조건 추가
```sql
-- category_id를 NOT NULL로 변경 (옵션)
ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;

-- 기존 category 컬럼 백업 후 삭제
ALTER TABLE products RENAME COLUMN category TO category_old;
-- (나중에 삭제: DROP COLUMN category_old)
```

---

### Phase 3: RPC 함수 수정

**파일**: `database/products_rpc_functions_category.sql` (작성 예정)

#### 3-1. get_products_list
```sql
-- 기존
SELECT 
  p.id,
  p.code,
  p.name,
  p.category,  -- TEXT
  ...

-- 수정
SELECT 
  p.id,
  p.code,
  p.name,
  p.category_id,
  pc.code AS category_code,
  pc.name AS category_name,
  ...
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id;
```

#### 3-2. create_product
```sql
-- 파라미터 변경
CREATE OR REPLACE FUNCTION create_product(
  p_code TEXT,
  p_name TEXT,
  p_category_id UUID,  -- ✅ TEXT → UUID
  ...
)
```

#### 3-3. update_product
```sql
-- 파라미터 변경
CREATE OR REPLACE FUNCTION update_product(
  p_id UUID,
  p_category_id UUID,  -- ✅ TEXT → UUID
  ...
)
```

---

### Phase 4: TypeScript 타입 수정

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
  category_code?: string     // ✅ 추가 (조인 결과)
  category_name?: string     // ✅ 추가 (조인 결과)
  category?: string          // ⚠️ deprecated (하위 호환)
  unit: string
  ...
}
```

---

### Phase 5: 품목 입력 폼 수정

**파일**: `components/products/ProductForm.tsx`

#### 기존 (자유 입력)
```tsx
<Input
  type="text"
  value={formData.category}
  onChange={(e) => setFormData({...formData, category: e.target.value})}
/>
```

#### 수정 (드롭다운 선택)
```tsx
<select
  value={formData.category_id}
  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
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

### Phase 6: 레포트 필터 추가

#### 6-1. RPC 함수 수정
```sql
-- get_sales_report에 카테고리 필터 추가
CREATE OR REPLACE FUNCTION get_sales_report(
  ...,
  p_category_id TEXT DEFAULT NULL
)
...
WHERE 
  ...
  AND (p_category_id IS NULL OR p.category_id::TEXT = p_category_id)
```

#### 6-2. 클라이언트 UI
```tsx
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
```

---

## 📂 생성/수정할 파일

### 데이터베이스 (3개)
1. ✅ `database/create_product_categories.sql` - 테이블 생성, 초기 데이터
2. ⏳ `database/migrate_product_category.sql` - products 테이블 마이그레이션
3. ⏳ `database/products_rpc_functions_category.sql` - RPC 함수 수정

### 프론트엔드 (6개)
1. ⏳ `types/products.ts` - 타입 추가/수정
2. ⏳ `components/products/ProductForm.tsx` - 드롭다운 UI
3. ⏳ `components/products/ProductManagement.tsx` - 카테고리 조회
4. ⏳ `app/reports/sales/actions.ts` - 카테고리 필터
5. ⏳ `app/reports/purchases/actions.ts` - 카테고리 필터
6. ⏳ `components/reports/ReportFilters.tsx` - 카테고리 필터 UI

---

## 🧪 테스트 시나리오

### 1. 카테고리 테이블 생성
```sql
-- Supabase에서 실행
-- database/create_product_categories.sql

-- 확인
SELECT code, name, display_order FROM product_categories ORDER BY display_order;
```

**예상 결과**: 13개 카테고리 표시

### 2. 품목 입력 테스트
1. 품목 관리 페이지 접속
2. 신규 품목 등록
3. 카테고리: [드롭다운] 선택
4. 저장
5. **확인**: category_id에 UUID 저장됨

### 3. 레포트 필터 테스트
1. 판매 레포트 접속
2. 카테고리: "필러" 선택
3. 조회
4. **확인**: 필러 카테고리 품목만 표시

---

## ⚠️ 주의사항

### 1. 기존 데이터 마이그레이션
- 현재 `products.category`가 TEXT로 자유 입력되어 있음
- 새 `product_categories`와 매핑 전략 필요

#### 매핑 예시
```
기존 category (TEXT)     → 새 category_id (UUID)
-----------------        ------------------------
"필러"                   → 00001 (필러)
"보톡스"                 → 00002 (보톡스)
"Botox"                  → 00002 (보톡스)  ← 수동 매핑 필요
"화장품"                 → 00005 (화장품)
"기타"                   → 00003 (기타뷰티)
NULL                     → 00003 (기타뷰티)  ← 기본값
```

### 2. 백업 필수
```sql
-- products 테이블 백업
CREATE TABLE products_backup_20250126 AS 
SELECT * FROM products;
```

### 3. 롤백 계획
```sql
-- category_id 삭제
ALTER TABLE products DROP COLUMN category_id;

-- 백업에서 복구
-- ...
```

---

## 🎯 적용 순서 (실제 작업 시)

| 순서 | 작업 | 예상 시간 | 위험도 |
|------|------|-----------|--------|
| 1 | product_categories 테이블 생성 | 5분 | 낮음 |
| 2 | products 백업 | 1분 | - |
| 3 | products.category_id 추가 | 5분 | 중간 |
| 4 | 기존 데이터 매핑 (수동) | 30분 | 높음 |
| 5 | RPC 함수 수정 | 20분 | 중간 |
| 6 | TypeScript 타입 수정 | 10분 | 낮음 |
| 7 | 품목 폼 UI 수정 | 20분 | 낮음 |
| 8 | 레포트 필터 추가 | 30분 | 낮음 |
| 9 | 테스트 | 30분 | - |

**총 예상 시간**: 약 2.5시간

---

## 📌 카테고리 분류 체계 분석

### 그룹 1: 시술 재료
- 00001: 필러
- 00002: 보톡스
- 00004: 리프팅샵

### 그룹 2: 화장품/뷰티
- 00003: 기타뷰티
- 00005: 화장품

### 그룹 3: 의약품
- 00006: 악/주사
- 00007: 악/외용
- 00008: 악/기타

### 그룹 4: 스킨룸 관련
- 00009: 장비스킨룸
- 00010: 외용스킨룸
- 00011: 스킨스킨룸
- 00012: 샤푸스킨룸
- 00013: 기타스킨룸

---

## 💡 향후 개선 아이디어

### 1. 카테고리 계층 구조 (옵션)
```sql
ALTER TABLE product_categories ADD COLUMN parent_id UUID 
  REFERENCES product_categories(id);

-- 예시:
-- 의약품 (상위)
--   ├── 악/주사 (하위)
--   ├── 악/외용 (하위)
--   └── 악/기타 (하위)
```

### 2. 카테고리별 색상 코드 (옵션)
```sql
ALTER TABLE product_categories ADD COLUMN color_code VARCHAR(20);

-- 예시:
-- 필러: #FF6B6B (빨강)
-- 보톡스: #4ECDC4 (민트)
-- 화장품: #FFE66D (노랑)
```

### 3. 카테고리 아이콘 (옵션)
```sql
ALTER TABLE product_categories ADD COLUMN icon VARCHAR(50);

-- 예시:
-- 필러: '💉'
-- 화장품: '💄'
-- 의약품: '💊'
```

---

## 🚨 마이그레이션 전 체크리스트

### 실행 전 확인
- [ ] products 테이블 백업 완료
- [ ] 현재 category 값 확인 (유니크 값 리스트)
- [ ] 매핑 전략 수립
- [ ] 롤백 계획 수립

### 실행 SQL
```sql
-- 1. 현재 category 값 확인
SELECT DISTINCT category, COUNT(*) as count
FROM products
GROUP BY category
ORDER BY count DESC;

-- 2. 백업
CREATE TABLE products_backup_20250126 AS SELECT * FROM products;

-- 3. create_product_categories.sql 실행

-- 4. migrate_product_category.sql 실행

-- 5. 검증
SELECT 
  p.code,
  p.name,
  p.category_old,
  pc.name AS category_new
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
LIMIT 20;
```

---

## 📊 예상 UI (완료 후)

### 품목 입력 폼

```
┌─────────────────────────────────────────┐
│ 품목 등록                               │
├─────────────────────────────────────────┤
│ 품목코드: [P001           ]            │
│ 품목명:   [생리식염수 500ml]            │
│ 카테고리: [악/외용        ▼]  ← 드롭다운│
│           - 필러                        │
│           - 보톡스                      │
│           - 기타뷰티                    │
│           - ...                         │
│ 단위:     [개             ]            │
└─────────────────────────────────────────┘
```

### 레포트 필터

```
┌─────────────────────────────────────────┐
│ 📊 판매 레포트                          │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│ │ 시작일   │ │ 종료일   │ │ 카테고리  │  │
│ └─────────┘ └─────────┘ │  ▼        │  │
│                          │ ○ 전체     │  │
│                          │ ○ 필러     │  │
│                          │ ○ 보톡스   │  │
│                          │ ○ 화장품   │  │
│                          └──────────┘  │
└─────────────────────────────────────────┘
```

---

**작성일**: 2025-01-26  
**상태**: 계획 수립 완료, Phase 1 SQL 작성 완료  
**다음 단계**: Phase 1 실행 또는 전체 마이그레이션 계획 승인 대기

