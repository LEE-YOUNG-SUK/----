# ✅ 판매/사용 분리 문제 수정 완료

## 🚨 발견된 문제점

### 문제 1: saveSales에서 transaction_type 전달 누락 ✅ 해결
- **증상**: 사용(USAGE) 입력해도 판매(SALE)로 저장됨
- **원인**: RPC 호출 시 `p_transaction_type` 파라미터 누락
- **해결**: `app/sales/actions.ts` - RPC 파라미터 추가

### 문제 2: get_sales_list에서 transaction_type 필터 미지원 ✅ 해결
- **증상**: 판매 내역과 사용 내역이 섞여서 표시됨
- **원인**: RPC 함수가 `transaction_type` 필터를 지원하지 않음
- **해결**: `database/fix_sales_list_filter.sql` 생성

### 문제 3: 레포트에서 transaction_type 필터 없음 ✅ 해결
- **증상**: 판매 레포트에 사용 데이터 포함, 재료비 레포트에 판매 데이터 포함
- **원인**: RPC 함수에 필터 없음
- **해결**: 
  - 판매 레포트: RPC에 `p_transaction_type: 'SALE'` 추가
  - 재료비 레포트: 이미 `.eq('transaction_type', 'USAGE')` 적용됨 ✅

---

## 📂 수정된 파일

### 1. Server Actions
**파일: `app/sales/actions.ts`**
- ✅ `saveSales`: `p_transaction_type` 파라미터 전달
- ✅ `getSalesHistory`: `p_transaction_type` 파라미터 전달

### 2. 판매 레포트
**파일: `app/reports/sales/actions.ts`**
- ✅ `getSalesReport`: `p_transaction_type: 'SALE'` 추가

### 3. 재료비 레포트
**파일: `app/reports/usage/actions.ts`**
- ✅ 이미 `.eq('transaction_type', 'USAGE')` 적용됨

---

## 🗄️ 데이터베이스 수정 (필수!)

### 순서대로 Supabase에서 실행:

#### 1단계: get_sales_list 함수 수정
```sql
-- database/fix_sales_list_filter.sql 실행
```

**변경 내용**:
- 5번째 파라미터 `p_transaction_type TEXT DEFAULT NULL` 추가
- WHERE 절에 transaction_type 필터 추가
- 반환 컬럼에 `transaction_type TEXT` 추가

#### 2단계: get_sales_report 함수 수정
```sql
-- database/fix_sales_report_filter.sql 실행
```

**변경 내용**:
- 6번째 파라미터 `p_transaction_type TEXT DEFAULT 'SALE'` 추가
- 모든 그룹핑 쿼리에 transaction_type 필터 추가

---

## 🔍 수정 전/후 비교

### saveSales 함수

**수정 전**:
```typescript
const { data, error } = await supabase.rpc('process_batch_sale', {
  p_branch_id: data.branch_id,
  p_client_id: data.customer_id,
  p_sale_date: data.sale_date,
  p_reference_number: data.reference_number || null,
  p_notes: data.notes || '',
  p_created_by: data.created_by,
  p_items: itemsJson as any
  // ❌ p_transaction_type 누락!
})
```

**수정 후**:
```typescript
const { data: rpcData, error } = await supabase.rpc('process_batch_sale', {
  p_branch_id: data.branch_id,
  p_client_id: data.customer_id,
  p_sale_date: data.sale_date,
  p_reference_number: data.reference_number || null,
  p_notes: data.notes || '',
  p_created_by: data.created_by,
  p_items: itemsJson as any,
  p_transaction_type: data.transaction_type || 'SALE'  // ✅ 추가!
})
```

### getSalesHistory 함수

**수정 전**:
```typescript
const { data, error } = await supabase.rpc('get_sales_list', {
  p_branch_id: branchId,
  p_start_date: startDate || null,
  p_end_date: endDate || null,
  p_user_id: userId
  // ❌ p_transaction_type 누락!
})
// 클라이언트 측 필터링 (비효율)
let filteredData = data || []
if (transactionType) {
  filteredData = filteredData.filter((item: any) => item.transaction_type === transactionType)
}
```

**수정 후**:
```typescript
const { data, error } = await supabase.rpc('get_sales_list', {
  p_branch_id: branchId,
  p_start_date: startDate || null,
  p_end_date: endDate || null,
  p_user_id: userId,
  p_transaction_type: transactionType || null  // ✅ 추가!
})
// 서버 측 필터링 (효율적)
```

### get_sales_list RPC 함수

**수정 전**:
```sql
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
  -- ❌ p_transaction_type 없음
)
RETURNS TABLE (
  -- ...
  -- ❌ transaction_type 반환 안 함
)
```

**수정 후**:
```sql
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL  -- ✅ 추가
)
RETURNS TABLE (
  -- ...
  transaction_type TEXT  -- ✅ 추가
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- ...
    COALESCE(s.transaction_type, 'SALE') AS transaction_type
  FROM sales s
  WHERE 
    -- ...
    AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)  -- ✅ 추가
END;
$$;
```

### get_sales_report RPC 함수

**수정 전**:
```sql
CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'
  -- ❌ p_transaction_type 없음
)
```

**수정 후**:
```sql
CREATE OR REPLACE FUNCTION get_sales_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily',
  p_transaction_type TEXT DEFAULT 'SALE'  -- ✅ 추가
)
-- 모든 WHERE 절에 필터 추가:
WHERE 
  -- ...
  AND COALESCE(s.transaction_type, 'SALE') = p_transaction_type
```

---

## 🧪 테스트 시나리오

### 1. 사용 입력 테스트

#### 테스트 절차:
1. `/usage` 페이지 접속
2. 품목 선택 (예: 생리식염수)
3. 수량 입력 (예: 10)
4. 저장 클릭

#### 예상 결과:
```sql
-- DB 확인 쿼리
SELECT 
  id, 
  sale_date, 
  product_id, 
  quantity, 
  unit_price, 
  transaction_type
FROM sales 
WHERE id = '방금_생성된_ID';

-- 결과
transaction_type: 'USAGE' ✅
```

### 2. 히스토리 분리 테스트

#### 테스트 절차:
1. `/sales` 페이지 → "판매 내역" 탭
2. `/usage` 페이지 → "사용 내역" 탭

#### 예상 결과:
- 판매 페이지: SALE 건만 표시 ✅
- 사용 페이지: USAGE 건만 표시 ✅

### 3. 레포트 분리 테스트

#### 테스트 절차:
1. `/reports/sales` 접속 → 조회 버튼 클릭
2. `/reports/usage` 접속 → 조회 버튼 클릭

#### 예상 결과:
- 판매 레포트: SALE 건만 집계 ✅
- 재료비 레포트: USAGE 건만 집계 ✅

---

## 📋 적용 체크리스트

### Supabase SQL Editor에서 실행:

- [ ] 1. `database/fix_sales_list_filter.sql` 실행
  - ✅ `get_sales_list` 함수 재생성
  - ✅ `p_transaction_type` 파라미터 추가
  - ✅ WHERE 절에 필터 추가

- [ ] 2. `database/fix_sales_report_filter.sql` 실행
  - ✅ `get_sales_report` 함수 재생성
  - ✅ `p_transaction_type` 파라미터 추가
  - ✅ 모든 그룹핑 쿼리에 필터 추가

### 프론트엔드 (이미 완료):

- [x] `app/sales/actions.ts` - saveSales 수정
- [x] `app/sales/actions.ts` - getSalesHistory 수정
- [x] `app/reports/sales/actions.ts` - SALE 필터 추가
- [x] `app/reports/usage/actions.ts` - USAGE 필터 확인 (이미 적용됨)

---

## 🎯 수정 요약

| 문제 | 원인 | 해결 방법 | 파일 |
|------|------|----------|------|
| 사용이 판매로 저장 | `p_transaction_type` 누락 | RPC 파라미터 추가 | `app/sales/actions.ts` |
| 히스토리 분리 안됨 | RPC 필터 미지원 | `get_sales_list` 함수 수정 | `database/fix_sales_list_filter.sql` |
| 레포트 데이터 중복 | RPC 필터 없음 | `get_sales_report` 함수 수정 | `database/fix_sales_report_filter.sql` |

---

## 🗄️ 데이터베이스 함수 변경 내역

### 1. get_sales_list
```
변경 전: get_sales_list(UUID, DATE, DATE, UUID)
변경 후: get_sales_list(UUID, DATE, DATE, UUID, TEXT)
         └─────────────────────────────────┘
                5번째 파라미터 추가: p_transaction_type
```

### 2. get_sales_report
```
변경 전: get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT)
변경 후: get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
         └────────────────────────────────────────────┘
                      6번째 파라미터 추가: p_transaction_type
```

---

## 💾 SQL 실행 순서

```sql
-- 1. 판매/사용 내역 조회 함수 수정
-- database/fix_sales_list_filter.sql

-- 2. 판매 레포트 함수 수정
-- database/fix_sales_report_filter.sql
```

**실행 후 예상 메시지**:
```
✅ get_sales_list 함수 수정 완료 (transaction_type 필터 추가)
✅ get_sales_report 함수 수정 완료 (transaction_type 필터 추가)
```

---

## 🎉 기대 효과

### 수정 전 (문제)
```
/sales 페이지에서 저장 → transaction_type: NULL 또는 'SALE'
/usage 페이지에서 저장 → transaction_type: NULL 또는 'SALE' ❌

히스토리:
  - 판매 페이지: 모든 거래 표시 ❌
  - 사용 페이지: 모든 거래 표시 ❌

레포트:
  - 판매 레포트: 모든 거래 집계 ❌
  - 재료비 레포트: USAGE만 집계 ✅
```

### 수정 후 (정상)
```
/sales 페이지에서 저장 → transaction_type: 'SALE' ✅
/usage 페이지에서 저장 → transaction_type: 'USAGE' ✅

히스토리:
  - 판매 페이지: SALE만 표시 ✅
  - 사용 페이지: USAGE만 표시 ✅

레포트:
  - 판매 레포트: SALE만 집계 ✅
  - 재료비 레포트: USAGE만 집계 ✅
```

---

## 🎯 빌드 결과

```
Route (app)
├ ƒ /sales              ← 판매 관리 (SALE)
├ ƒ /usage              ← 사용 관리 (USAGE)
├ ƒ /reports/sales      ← 판매 레포트 (SALE)
└ ƒ /reports/usage      ← 재료비 레포트 (USAGE)
```

**✅ 빌드 성공!** (TypeScript 에러 0개)

---

## 📊 데이터 흐름 다이어그램

### 판매 (SALE)
```
/sales 페이지
  ↓ transactionType="SALE"
SaleForm
  ↓ transaction_type: 'SALE'
saveSales()
  ↓ p_transaction_type: 'SALE'
process_batch_sale RPC
  ↓ INSERT ... transaction_type = 'SALE'
sales 테이블
  ↓
get_sales_list(p_transaction_type='SALE')
  ↓ WHERE transaction_type = 'SALE'
판매 내역 (SALE만)
```

### 사용 (USAGE)
```
/usage 페이지
  ↓ transactionType="USAGE"
SaleForm
  ↓ transaction_type: 'USAGE'
saveSales()
  ↓ p_transaction_type: 'USAGE'
process_batch_sale RPC
  ↓ INSERT ... transaction_type = 'USAGE'
sales 테이블
  ↓
get_sales_list(p_transaction_type='USAGE')
  ↓ WHERE transaction_type = 'USAGE'
사용 내역 (USAGE만)
```

---

## 🧪 검증 쿼리

### 1. transaction_type 분포 확인
```sql
SELECT 
  COALESCE(transaction_type, 'NULL') AS type,
  COUNT(*) AS count
FROM sales
GROUP BY transaction_type
ORDER BY count DESC;
```

**예상 결과**:
```
type    | count
--------|------
SALE    | 150
USAGE   | 80
NULL    | 0 (기존 데이터는 SALE로 업데이트됨)
```

### 2. 판매/사용 데이터 확인
```sql
-- 판매 데이터
SELECT 
  sale_date,
  product_id,
  quantity,
  unit_price,
  profit,
  transaction_type
FROM sales
WHERE transaction_type = 'SALE'
ORDER BY sale_date DESC
LIMIT 5;

-- 사용 데이터
SELECT 
  sale_date,
  product_id,
  quantity,
  unit_price,
  profit,
  transaction_type
FROM sales
WHERE transaction_type = 'USAGE'
ORDER BY sale_date DESC
LIMIT 5;
```

**예상 결과**:
- SALE: `profit > 0`, 고객 선택됨
- USAGE: `profit = 0`, 고객 '내부사용'

---

## ✅ 완료 체크리스트

### DB 적용 (사용자 작업 필요)
- [ ] `database/fix_sales_list_filter.sql` 실행
- [ ] `database/fix_sales_report_filter.sql` 실행

### 프론트엔드 (완료)
- [x] `app/sales/actions.ts` 수정
- [x] `app/reports/sales/actions.ts` 수정
- [x] `app/reports/usage/actions.ts` 확인
- [x] 빌드 테스트 성공

### 테스트 (DB 적용 후)
- [ ] 사용 입력 → DB에 'USAGE' 저장 확인
- [ ] 판매 페이지 → SALE만 표시
- [ ] 사용 페이지 → USAGE만 표시
- [ ] 판매 레포트 → SALE만 집계
- [ ] 재료비 레포트 → USAGE만 집계

---

## 🎉 최종 상태

| 기능 | transaction_type 필터 | 상태 |
|------|----------------------|------|
| 판매 입력 | `'SALE'` 전달 | ✅ |
| 사용 입력 | `'USAGE'` 전달 | ✅ |
| 판매 내역 | `'SALE'` 필터 | ✅ |
| 사용 내역 | `'USAGE'` 필터 | ✅ |
| 판매 레포트 | `'SALE'` 필터 | ✅ |
| 재료비 레포트 | `'USAGE'` 필터 | ✅ |

---

**작업 완료일**: 2025-01-26  
**빌드 상태**: ✅ 성공  
**DB 적용**: ⏳ 대기 중 (2개 SQL 파일 실행 필요)

