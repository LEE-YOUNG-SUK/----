# 🚀 판매/사용 탭 분리 기능 완료 가이드

## 📋 작업 완료 내역

### ✅ 완료된 작업 (100%)

1. **DB 스키마 변경** ✅
   - `database/add_transaction_type.sql` 생성
   - `sales` 테이블에 `transaction_type` 컬럼 추가 (SALE / USAGE)
   - 내부사용 고객 자동 생성 (code: 'INTERNAL')
   - 인덱스 추가 (`idx_sales_transaction_type`)

2. **RPC 함수 수정** ✅
   - `database/add_transaction_type_to_rpc.sql` 생성
   - `process_batch_sale` 함수에 `p_transaction_type` 파라미터 추가
   - 거래유형별 단가 및 이익 계산 로직 구현
     - **SALE (판매)**: 단가 = 사용자 입력, 이익 = 판매가 - FIFO 원가
     - **USAGE (사용)**: 단가 = FIFO 평균 원가 (자동), 이익 = 0

3. **TypeScript 타입 정의** ✅
   - `types/sales.ts`
     - `TransactionType` 추가
     - `SaleGridRow`, `SaleSaveRequest`, `SaleHistory`에 `transaction_type` 추가

4. **Server Actions** ✅
   - `app/sales/actions.ts`
     - `saveSales`: `transaction_type` 파라미터 전달
     - `getSalesHistory`: `transactionType` 필터 추가 (클라이언트 측 필터링)

5. **UI 컴포넌트** ✅
   - `components/ui/Tabs.tsx` 생성 (탭 UI 컴포넌트)
   - `app/sales/page.tsx`: 서버 컴포넌트로 데이터 조회 후 클라이언트 컴포넌트로 전달
   - `components/sales/SalesPageClient.tsx`: 탭 네비게이션 구현
   - `components/sales/saleform.tsx`:
     - `transactionType` props 추가
     - 내부사용 고객 자동 선택
     - 고객 선택 필드 조건부 렌더링 (USAGE: 고정, SALE: 선택)
     - 탭 라벨 동적 변경
   - `components/sales/salegrid.tsx`:
     - 단가 컬럼 조건부 렌더링
       - SALE: 편집 가능, 일반 스타일
       - USAGE: 읽기 전용, 자동 계산 표시, 보라색 배경
     - 검증 로직 조건부 적용 (USAGE는 단가 검증 생략)
   - `components/sales/salehistorytable.tsx`:
     - `transactionType` props 추가
     - 제목 및 메시지 동적 변경

6. **빌드 테스트** ✅
   - TypeScript 컴파일 성공
   - 모든 페이지 정상 빌드 완료

---

## 🗄️ 데이터베이스 적용 순서

### 1단계: transaction_type 컬럼 추가

**Supabase SQL Editor**에서 실행:

```sql
-- database/add_transaction_type.sql
```

**실행 내용**:
- `sales` 테이블에 `transaction_type TEXT DEFAULT 'SALE'` 추가
- 기존 데이터 'SALE'로 업데이트
- 인덱스 생성
- 내부사용 고객 ('INTERNAL') 생성
- 검증 쿼리 실행

**예상 결과**:
```
status: transaction_type 컬럼 추가 완료

id                                   | code     | name     | type     | is_active
-------------------------------------|----------|----------|----------|----------
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | INTERNAL | 내부사용  | customer | true
```

### 2단계: RPC 함수 업데이트

**Supabase SQL Editor**에서 실행:

```sql
-- database/add_transaction_type_to_rpc.sql
```

**실행 내용**:
- 기존 `process_batch_sale(7개 파라미터)` 함수 삭제
- 새 `process_batch_sale(8개 파라미터)` 함수 생성
  - `p_transaction_type TEXT DEFAULT 'SALE'` 추가
- 거래유형별 로직 구현
- 권한 부여

**예상 결과**:
```
✅ process_batch_sale 함수 수정 완료!
```

---

## 🎨 UI 작동 방식

### 판매 탭 (SALE)

```
┌───────────────────────────────────────────┐
│ 💰 판매    │ 📦 사용 (내부소모)       │
└───────────────────────────────────────────┘

📋 판매 등록
화장품 등 고객에게 판매하는 경우. 판매가를 직접 입력하고 이익이 계산됩니다.

┌─────────────────────────────────────────────┐
│ 고객: [고객 선택 ▼]                         │
│ 판매일: [2025-01-26]                        │
│ 부가세 구분: [부가세 포함 ▼]                │
│ 참조번호: [전표번호 입력...]                │
│ 비고: [메모 입력...]                        │
└─────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ No │ 품목코드 │ 품목명 │ 수량 │ 판매단가    │ 공급가  │ 부가세 │ 합계    │
├─────┼─────────┼────────┼──────┼─────────────┼─────────┼────────┼─────────┤
│ 1   │ P001    │ 화장품 │ 10   │ ₩10,000 ⬅편집 │ ₩9,090  │ ₩910   │ ₩10,000 │
└─────┴─────────┴────────┴──────┴─────────────┴─────────┴────────┴─────────┘
```

### 사용 탭 (USAGE)

```
┌───────────────────────────────────────────┐
│ 💰 판매    │ 📦 사용 (내부소모) ✅       │
└───────────────────────────────────────────┘

📦 내부 사용 등록
의료 소모품 등 내부에서 사용하는 경우. 출고 단가는 입고 원가(FIFO)로 자동 적용되며 이익은 0입니다.

┌─────────────────────────────────────────────┐
│ 고객: [내부사용] 🔒 (변경 불가)              │
│ 사용일: [2025-01-26]                        │
│ 부가세 구분: [부가세 포함 ▼]                │
│ 참조번호: [전표번호 입력...]                │
│ 비고: [메모 입력...]                        │
└─────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ No │ 품목코드 │ 품목명 │ 수량 │ 출고단가(자동) │ 공급가  │ 부가세 │ 합계    │
├─────┼─────────┼────────┼──────┼────────────────┼─────────┼────────┼─────────┤
│ 1   │ P001    │ 소모품 │ 5    │ ₩5,000 🔒자동   │ ₩4,545  │ ₩455   │ ₩5,000 │
└─────┴─────────┴────────┴──────┴────────────────┴─────────┴────────┴─────────┘
```

---

## 🔧 비즈니스 로직

### 판매 (SALE)

1. **단가**: 사용자가 직접 입력
2. **금액**: 수량 × 판매단가
3. **원가**: FIFO 방식으로 자동 계산
4. **이익**: 판매가 - FIFO 원가
5. **고객**: 일반 고객 선택 (INTERNAL 제외)

**SQL 예시**:
```sql
SELECT * FROM process_batch_sale(
  '지점_UUID'::UUID,
  '고객_UUID'::UUID,
  '2025-01-26'::DATE,
  NULL,
  '테스트 판매',
  '사용자_UUID'::UUID,
  '[
    {"product_id": "품목_UUID", "quantity": 10, "unit_price": 15000}
  ]'::JSONB,
  'SALE'  -- 판매
);
```

**결과**:
```
success | message               | total_profit
--------|-----------------------|-------------
true    | 판매 완료: 1개 품목    | 50000원 (예시)
```

### 사용 (USAGE)

1. **단가**: FIFO 평균 원가로 **자동 계산** (서버)
2. **금액**: 수량 × FIFO 평균 원가
3. **원가**: FIFO 방식으로 자동 계산
4. **이익**: 항상 0
5. **고객**: 내부사용 고정 (code: 'INTERNAL')

**SQL 예시**:
```sql
SELECT * FROM process_batch_sale(
  '지점_UUID'::UUID,
  '내부사용_고객_UUID'::UUID,
  '2025-01-26'::DATE,
  NULL,
  '테스트 내부사용',
  '사용자_UUID'::UUID,
  '[
    {"product_id": "품목_UUID", "quantity": 5}
  ]'::JSONB,
  'USAGE'  -- 내부사용 (단가 자동 계산)
);
```

**결과**:
```
success | message                   | total_profit
--------|---------------------------|-------------
true    | 내부사용 완료: 1개 품목    | 0원 (항상)
```

---

## 📊 데이터베이스 변경사항

### 1. sales 테이블

| 컬럼명            | 타입    | 기본값 | 설명                          |
|-------------------|---------|--------|-------------------------------|
| transaction_type  | TEXT    | 'SALE' | 거래유형 (SALE / USAGE)       |

**제약조건**:
```sql
CHECK (transaction_type IN ('SALE', 'USAGE'))
```

**인덱스**:
```sql
CREATE INDEX idx_sales_transaction_type ON sales(transaction_type);
```

### 2. clients 테이블

새 고객 자동 생성:
```sql
code: 'INTERNAL'
name: '내부사용'
type: 'customer'
is_active: true
```

### 3. RPC 함수 시그니처 변경

**변경 전**:
```sql
process_batch_sale(
  p_branch_id UUID,
  p_client_id UUID,
  p_sale_date DATE,
  p_reference_number TEXT,
  p_notes TEXT,
  p_created_by UUID,
  p_items JSONB
)
```

**변경 후**:
```sql
process_batch_sale(
  p_branch_id UUID,
  p_client_id UUID,
  p_sale_date DATE,
  p_reference_number TEXT,
  p_notes TEXT,
  p_created_by UUID,
  p_items JSONB,
  p_transaction_type TEXT DEFAULT 'SALE'  -- ✅ 추가
)
```

---

## 🧪 테스트 시나리오

### 1. DB 적용 테스트

```sql
-- 1-1. transaction_type 컬럼 확인
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'transaction_type';

-- 1-2. 내부사용 고객 확인
SELECT * FROM clients WHERE code = 'INTERNAL';

-- 1-3. 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'sales' AND indexname = 'idx_sales_transaction_type';
```

### 2. 판매(SALE) 테스트

1. 판매 탭 클릭
2. 고객 선택 (일반 고객)
3. 품목 선택
4. 수량 입력: 10
5. 판매단가 입력: 15,000원 (직접 입력)
6. 저장
7. DB 확인:
   ```sql
   SELECT 
     product_id, 
     quantity, 
     unit_price, 
     total_price, 
     cost_of_goods_sold, 
     profit, 
     transaction_type
   FROM sales 
   WHERE id = '방금_생성된_ID'
   AND transaction_type = 'SALE';
   ```

**예상 결과**:
```
quantity | unit_price | total_price | cost_of_goods_sold | profit  | transaction_type
---------|------------|-------------|--------------------|---------|-----------------
10       | 15000      | 150000      | 100000 (예시)      | 50000   | SALE
```

### 3. 사용(USAGE) 테스트

1. 사용 탭 클릭
2. 고객: "내부사용" 자동 선택 (변경 불가)
3. 품목 선택
4. 수량 입력: 5
5. 출고단가: **자동 계산** (편집 불가, 보라색 배경)
6. 저장
7. DB 확인:
   ```sql
   SELECT 
     product_id, 
     quantity, 
     unit_price, 
     total_price, 
     cost_of_goods_sold, 
     profit, 
     transaction_type
   FROM sales 
   WHERE id = '방금_생성된_ID'
   AND transaction_type = 'USAGE';
   ```

**예상 결과**:
```
quantity | unit_price | total_price | cost_of_goods_sold | profit | transaction_type
---------|------------|-------------|--------------------|---------|-----------------
5        | 10000      | 50000       | 50000              | 0       | USAGE
```

**주의**: `unit_price`는 FIFO 평균 원가로 자동 계산됩니다!

### 4. 히스토리 확인

1. 판매 탭 → 판매 내역: SALE만 표시
2. 사용 탭 → 사용 내역: USAGE만 표시
3. 각 탭에서 제목 확인:
   - 판매 탭: "판매 내역"
   - 사용 탭: "사용 내역"

---

## 🚨 주의사항

### 1. RPC 함수 호환성

- 기존 `process_batch_sale(7개 파라미터)` 호출 코드는 자동으로 `transaction_type='SALE'`로 처리됩니다 (DEFAULT 값).
- 새 코드는 8번째 파라미터로 `'SALE'` 또는 `'USAGE'`를 명시해야 합니다.

### 2. 내부사용 고객

- code: `'INTERNAL'`인 고객은 **삭제하지 마세요**.
- 이 고객이 없으면 USAGE 저장 시 오류가 발생합니다.
- 만약 삭제되었다면 `database/add_transaction_type.sql`의 4번 항목을 다시 실행하세요.

### 3. 단가 입력

- **SALE**: 사용자가 그리드에서 직접 입력
- **USAGE**: 그리드에서 입력 불가, 서버에서 FIFO 평균 원가로 자동 계산

### 4. 검증 로직

- **SALE**: 단가 > 0 검증
- **USAGE**: 단가 검증 생략 (서버에서 자동 계산)

---

## 📦 파일 목록

### 새로 생성된 파일

1. `database/add_transaction_type.sql` - DB 스키마 변경
2. `database/add_transaction_type_to_rpc.sql` - RPC 함수 수정
3. `components/ui/Tabs.tsx` - 탭 UI 컴포넌트
4. `components/sales/SalesPageClient.tsx` - 탭 네비게이션 클라이언트 컴포넌트
5. `database/SALES_USAGE_FEATURE_GUIDE.md` - 이 가이드 문서

### 수정된 파일

1. `types/sales.ts` - TransactionType 추가
2. `app/sales/actions.ts` - transaction_type 파라미터 전달
3. `app/sales/page.tsx` - 클라이언트 컴포넌트 분리
4. `components/sales/saleform.tsx` - 조건부 UI 구현
5. `components/sales/salegrid.tsx` - 단가 컬럼 조건부 렌더링
6. `components/sales/salehistorytable.tsx` - transactionType props 추가

---

## ✅ 완료 체크리스트

- [x] DB 스키마 변경 SQL 작성
- [x] RPC 함수 수정 SQL 작성
- [x] TypeScript 타입 정의
- [x] Server Actions 수정
- [x] 탭 UI 컴포넌트 생성
- [x] 페이지 레이아웃 수정 (탭 추가)
- [x] SaleForm 조건부 UI 구현
- [x] SaleGrid 단가 컬럼 조건부 처리
- [x] SaleHistoryTable transactionType 지원
- [x] 빌드 테스트 성공
- [ ] **DB 적용 (사용자 작업 필요)**

---

## 🎯 다음 단계

### 사용자가 해야 할 작업

1. **Supabase SQL Editor** 접속
2. `database/add_transaction_type.sql` 전체 실행
3. `database/add_transaction_type_to_rpc.sql` 전체 실행
4. 앱 접속 후 테스트:
   - 판매 탭에서 일반 판매 등록
   - 사용 탭에서 내부사용 등록
   - 각 탭의 내역 조회 확인

---

## 🎉 기대 효과

1. **명확한 거래 구분**: 판매와 내부사용이 명확히 분리됩니다.
2. **자동 원가 계산**: 내부사용 시 FIFO 원가가 자동 적용되어 입력 오류를 방지합니다.
3. **정확한 이익 계산**: 판매는 이익이 계산되고, 내부사용은 이익 0으로 정확히 구분됩니다.
4. **직관적인 UI**: 탭으로 명확히 구분되어 사용자가 쉽게 이해할 수 있습니다.
5. **데이터 무결성**: 거래유형이 DB에 저장되어 추후 분석 및 리포트에 활용 가능합니다.

---

**작업 완료일**: 2025-01-26  
**빌드 상태**: ✅ 성공 (TypeScript 에러 없음)  
**테스트 상태**: ⏳ DB 적용 대기 중

