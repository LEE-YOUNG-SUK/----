# 입고/판매 부가세 기능 구현 - 데이터베이스 정리 인수인계서

## 📋 프로젝트 현황 요약

### 완료된 작업
1. ✅ **TypeScript 타입 정의** (`types/purchases.ts`)
   - `PurchaseGridRow`에 `supply_price`, `tax_amount`, `total_price` 필드 추가
   
2. ✅ **클라이언트 UI 구현** (`components/purchases/`)
   - `PurchaseForm.tsx`: 부가세 구분 드롭박스 추가 (부가세 포함/미포함)
   - `PurchaseGrid.tsx`: 
     - 컬럼 구조: 품목 → 수량 → 단가 → **공급가** → **부가세** → **합계**
     - 자동계산 로직 구현 (부가세 반올림 정수 처리)
     - 부가세 구분 변경 시 전체 행 재계산

3. ✅ **자동계산 로직**
   - **부가세 포함**: 합계 = 수량 × 단가 → 공급가 = Math.round(합계 ÷ 1.1) → 부가세 = 합계 - 공급가
   - **부가세 미포함**: 공급가 = 수량 × 단가 → 부가세 = Math.round(공급가 × 0.1) → 합계 = 공급가 + 부가세

### 🔴 미완료 작업 (DB 정합성 문제)

---

## 🚨 핵심 문제: 데이터베이스 스키마 불일치

### 문제 1: 컬럼 불일치
**현재 상황:**
- 클라이언트에서 계산: `supply_price`, `tax_amount`, `total_price`
- DB 테이블 (`purchases`/`sales`): 컬럼 구조 불명확
- RPC 함수: `supply_price`, `total_price` 파라미터 없음

**확인 필요:**
```sql
-- purchases 테이블에 다음 컬럼이 있는가?
- supply_price NUMERIC(15, 2)  -- 공급가 (부가세 제외)
- tax_amount NUMERIC(15, 2)    -- 부가세 (정수)
- total_price NUMERIC(15, 2)   -- 합계 (공급가 + 부가세)
- unit_cost NUMERIC(15, 2)     -- 단가 (사용자 입력)
- total_cost NUMERIC(15, 2)    -- 기존 필드 (호환성)

-- sales 테이블도 동일 구조 필요
```

### 문제 2: RPC 함수 파라미터 누락
**현재 RPC 함수** (`fix_tax_amount_rpc_functions.sql`):
```sql
CREATE OR REPLACE FUNCTION process_purchase_with_layers(
  p_branch_id TEXT,
  p_client_id TEXT,
  p_product_id TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,           -- 단가만 받음
  p_purchase_date DATE,
  p_created_by TEXT,
  p_tax_amount NUMERIC DEFAULT 0, -- 부가세만 추가됨
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
```

**문제점:**
- ❌ `p_supply_price` 파라미터 없음
- ❌ `p_total_price` 파라미터 없음
- ❌ INSERT 구문에서 `total_cost = p_quantity * p_unit_cost`로 **재계산** (클라이언트 계산 무시)

### 문제 3: Server Actions 불완전
**현재** (`app/purchases/actions.ts`):
```typescript
await supabase.rpc('process_purchase_with_layers', {
  p_unit_cost: item.unit_cost,
  p_tax_amount: item.tax_amount ?? 0,
  // ❌ supply_price 전달 안 됨
  // ❌ total_price 전달 안 됨
})
```

---

## 📝 데이터베이스 전반 재설계 필요 사항

### 1단계: 스키마 정리 및 통일

#### A. `purchases` 테이블 스키마 확정
```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  client_id UUID NOT NULL REFERENCES clients(id),  -- 공급업체
  product_id UUID NOT NULL REFERENCES products(id),
  purchase_date DATE NOT NULL,
  
  -- 수량/단가
  quantity NUMERIC(15, 4) NOT NULL,
  unit_cost NUMERIC(15, 2) NOT NULL,  -- 사용자 입력 단가
  
  -- 부가세 관련 (NEW)
  supply_price NUMERIC(15, 2) NOT NULL,   -- 공급가 (부가세 제외)
  tax_amount NUMERIC(15, 2) NOT NULL,     -- 부가세 (정수)
  total_price NUMERIC(15, 2) NOT NULL,    -- 합계 (공급가 + 부가세)
  
  -- 호환성 유지
  total_cost NUMERIC(15, 2) NOT NULL,     -- = total_price (기존 코드 호환용)
  
  -- 메타데이터
  reference_number TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**중요:** 
- `total_cost`는 기존 코드 호환을 위해 유지하되, `total_price`와 동일한 값 저장
- `supply_price`, `tax_amount`, `total_price`는 **NOT NULL** (필수 저장)

#### B. `sales` 테이블 스키마 (동일 구조)
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  client_id UUID NOT NULL REFERENCES clients(id),  -- 고객
  product_id UUID NOT NULL REFERENCES products(id),
  sale_date DATE NOT NULL,
  
  -- 수량/단가
  quantity NUMERIC(15, 4) NOT NULL,
  unit_price NUMERIC(15, 2) NOT NULL,  -- 사용자 입력 단가
  
  -- 부가세 관련 (NEW)
  supply_price NUMERIC(15, 2) NOT NULL,   -- 공급가
  tax_amount NUMERIC(15, 2) NOT NULL,     -- 부가세
  total_price NUMERIC(15, 2) NOT NULL,    -- 합계
  
  -- FIFO 원가 (기존)
  cost_of_goods_sold NUMERIC(15, 2),
  profit NUMERIC(15, 2),
  
  -- 호환성
  total_cost NUMERIC(15, 2) NOT NULL,  -- = total_price
  
  -- 메타데이터
  reference_number TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2단계: RPC 함수 재작성

#### A. `process_purchase_with_layers` (완전 재작성)
```sql
CREATE OR REPLACE FUNCTION process_purchase_with_layers(
  p_branch_id TEXT,
  p_client_id TEXT,
  p_product_id TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_supply_price NUMERIC,      -- 추가
  p_tax_amount NUMERIC,         -- 추가 (정수)
  p_total_price NUMERIC,        -- 추가
  p_purchase_date DATE,
  p_created_by TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, purchase_id TEXT) AS $$
DECLARE
  v_purchase_id TEXT;
BEGIN
  INSERT INTO purchases (
    branch_id, client_id, product_id, purchase_date,
    quantity, unit_cost,
    supply_price, tax_amount, total_price, total_cost,
    reference_number, notes, created_by
  ) VALUES (
    p_branch_id, p_client_id, p_product_id, p_purchase_date,
    p_quantity, p_unit_cost,
    p_supply_price, p_tax_amount, p_total_price, p_total_price,  -- total_cost = total_price
    p_reference_number, p_notes, p_created_by
  ) RETURNING id INTO v_purchase_id;

  RETURN QUERY SELECT TRUE, '입고 저장 성공', v_purchase_id;
END;
$$ LANGUAGE plpgsql;
```

#### B. `process_sale_with_fifo` (완전 재작성)
```sql
CREATE OR REPLACE FUNCTION process_sale_with_fifo(
  p_branch_id TEXT,
  p_client_id TEXT,
  p_product_id TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_supply_price NUMERIC,      -- 추가
  p_tax_amount NUMERIC,         -- 추가
  p_total_price NUMERIC,        -- 추가
  p_sale_date DATE,
  p_created_by TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, sale_id TEXT) AS $$
DECLARE
  v_sale_id TEXT;
BEGIN
  INSERT INTO sales (
    branch_id, client_id, product_id, sale_date,
    quantity, unit_price,
    supply_price, tax_amount, total_price, total_cost,
    reference_number, notes, created_by
  ) VALUES (
    p_branch_id, p_client_id, p_product_id, p_sale_date,
    p_quantity, p_unit_price,
    p_supply_price, p_tax_amount, p_total_price, p_total_price,
    p_reference_number, p_notes, p_created_by
  ) RETURNING id INTO v_sale_id;

  RETURN QUERY SELECT TRUE, '판매 저장 성공', v_sale_id;
END;
$$ LANGUAGE plpgsql;
```

### 3단계: Server Actions 수정

#### `app/purchases/actions.ts`
```typescript
await supabase.rpc('process_purchase_with_layers', {
  p_branch_id: data.branch_id,
  p_client_id: data.supplier_id,
  p_product_id: item.product_id,
  p_quantity: item.quantity,
  p_unit_cost: item.unit_cost,
  
  // 추가: 클라이언트 계산값 전달
  p_supply_price: item.supply_price,
  p_tax_amount: item.tax_amount,
  p_total_price: item.total_price,
  
  p_purchase_date: data.purchase_date,
  p_created_by: data.created_by,
  p_reference_number: data.reference_number || '',
  p_notes: item.notes || data.notes || ''
})
```

#### `app/sales/actions.ts` (동일 패턴)
```typescript
await supabase.rpc('process_sale_with_fifo', {
  p_branch_id: data.branch_id,
  p_client_id: data.customer_id,
  p_product_id: item.product_id,
  p_quantity: item.quantity,
  p_unit_price: item.unit_price,
  
  // 추가
  p_supply_price: item.supply_price,
  p_tax_amount: item.tax_amount,
  p_total_price: item.total_price,
  
  p_sale_date: data.sale_date,
  p_created_by: data.created_by,
  p_reference_number: data.reference_number || '',
  p_notes: item.notes || data.notes || ''
})
```

---

## 🔍 기존 DB 정리 필요 사항

### 검토 항목 체크리스트

#### 1. 테이블 스키마 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('purchases', 'sales')
ORDER BY table_name, ordinal_position;
```

**확인 사항:**
- [ ] `purchases` 테이블에 `supply_price` 컬럼 존재 여부
- [ ] `purchases` 테이블에 `tax_amount` 컬럼 존재 여부 (이전에 추가했으나 타입 확인 필요)
- [ ] `purchases` 테이블에 `total_price` 컬럼 존재 여부
- [ ] `sales` 테이블도 동일 구조인지 확인
- [ ] 기존 `total_cost` 컬럼과의 관계 확인

#### 2. RPC 함수 현황 확인
```sql
-- 기존 RPC 함수 목록 확인
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%purchase%' OR routine_name LIKE '%sale%'
ORDER BY routine_name;
```

**확인 사항:**
- [ ] `process_purchase_with_layers` 함수 존재 여부 및 파라미터 구조
- [ ] `process_sale_with_fifo` 함수 존재 여부 및 파라미터 구조
- [ ] 구버전 함수 잔재 확인 (충돌 방지)

#### 3. 기존 데이터 마이그레이션 필요성
```sql
-- 기존 입고/판매 데이터 확인
SELECT COUNT(*) as purchase_count FROM purchases;
SELECT COUNT(*) as sales_count FROM sales;

-- 샘플 데이터 구조 확인
SELECT * FROM purchases LIMIT 5;
SELECT * FROM sales LIMIT 5;
```

**고려 사항:**
- 기존 데이터가 있다면 `supply_price`, `tax_amount`, `total_price` 계산하여 UPDATE 필요
- 기존 `total_cost` 기준으로 역계산 가능 (부가세 포함 가정 시: supply_price = total_cost / 1.1)

---

## 📋 데이터베이스 재설정 작업 순서

### Phase 1: 현황 파악 (새 채팅에서 첫 작업)
1. 테이블 스키마 전체 조회
2. RPC 함수 시그니처 확인
3. 기존 데이터 건수 확인
4. 컬럼별 데이터 샘플 확인

### Phase 2: 스키마 통일
1. `purchases` 테이블 ALTER:
   ```sql
   ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supply_price NUMERIC(15, 2);
   ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_price NUMERIC(15, 2);
   -- tax_amount는 이미 추가했을 가능성 있음 (타입 확인)
   ```

2. `sales` 테이블 ALTER (동일)

3. NOT NULL 제약 조건은 데이터 채운 후 적용

### Phase 3: 기존 데이터 마이그레이션
```sql
-- 부가세 포함 가정하여 역계산
UPDATE purchases
SET 
  supply_price = ROUND(total_cost / 1.1),
  tax_amount = total_cost - ROUND(total_cost / 1.1),
  total_price = total_cost
WHERE supply_price IS NULL;

-- sales도 동일
```

### Phase 4: RPC 함수 재작성
1. 기존 함수 DROP
2. 새 함수 CREATE (파라미터 추가)
3. 테스트

### Phase 5: Server Actions 수정
1. `app/purchases/actions.ts` 수정
2. `app/sales/actions.ts` 수정

### Phase 6: 통합 테스트
1. 입고 1건 테스트 (부가세 포함)
2. 입고 1건 테스트 (부가세 미포함)
3. 입고 10건 일괄 테스트
4. DB 데이터 확인 (모든 컬럼 올바르게 저장되는지)

---

## ⚠️ 주의사항

### 데이터베이스 작업 시
1. **백업 필수**: 작업 전 Supabase 대시보드에서 스냅샷 생성
2. **트랜잭션 사용**: 여러 작업은 BEGIN; ... COMMIT; 블록으로 묶기
3. **롤백 준비**: 각 단계별 롤백 SQL 미리 작성

### 타입 정합성
- TypeScript 타입 (`types/purchases.ts`)
- Server Actions 파라미터
- RPC 함수 파라미터
- DB 테이블 컬럼

→ **4곳 모두 일치해야 함**

### 호환성 유지
- `total_cost` 컬럼은 삭제하지 말고 `total_price`와 동기화
- 기존 조회 쿼리에서 `total_cost` 사용 중일 수 있음

---

## 📂 관련 파일 위치

### 클라이언트 (완료)
- `types/purchases.ts` - 타입 정의
- `components/purchases/PurchaseForm.tsx` - 부가세 구분 UI
- `components/purchases/PurchaseGrid.tsx` - 자동계산 로직

### 서버 (수정 필요)
- `app/purchases/actions.ts` - RPC 호출 파라미터 추가 필요
- `app/sales/actions.ts` - RPC 호출 파라미터 추가 필요

### 데이터베이스 (전면 재작업 필요)
- `database/complete_schema.sql` - 마스터 스키마 (전체 재작성)
- `database/purchases_sales_inventory_tables.sql` - 테이블 정의
- `database/purchases_sales_rpc_functions.sql` - RPC 함수
- `database/fix_tax_amount_rpc_functions.sql` - 최근 시도한 버전 (불완전)

---

## 🎯 다음 채팅 시작 시 첫 질문

```
"입고/판매 부가세 기능 DB 재설정 작업을 진행하려고 합니다.
먼저 현재 데이터베이스 상태를 파악하기 위해 다음을 확인해주세요:

1. purchases 테이블의 전체 컬럼 구조 조회
2. sales 테이블의 전체 컬럼 구조 조회
3. process_purchase_with_layers 함수의 파라미터 구조 조회
4. process_sale_with_fifo 함수의 파라미터 구조 조회

Supabase SQL Editor에서 실행할 쿼리를 작성해주세요."
```

---

## 📌 핵심 요약

**문제:** 클라이언트에서 계산한 `supply_price`, `tax_amount`, `total_price`가 DB에 저장되지 않음

**원인:** 
1. DB 테이블에 컬럼 누락 가능성
2. RPC 함수 파라미터 누락 확실
3. Server Actions에서 데이터 전달 안 함

**해결책:** DB 스키마 → RPC 함수 → Server Actions 순서로 **일관성 있게 전면 재작성**

**작업 우선순위:** 현황 파악 → 스키마 통일 → 데이터 마이그레이션 → RPC 재작성 → 테스트
