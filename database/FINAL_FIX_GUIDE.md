# 🎯 최종 수정 가이드

## 🔍 문제 요약

### 발견된 문제
1. **`get_sales_list` 함수가 2개 버전 존재**
   - **버전 1 (TEXT)**: `id`, `sale_date` 반환 ✅
   - **버전 2 (UUID)**: `out_id`, `out_sale_date` 반환 ❌

2. **Server Actions에서 UUID로 RPC 호출**
   - PostgreSQL이 UUID 버전을 선택
   - 클라이언트는 `id`를 기대하지만 `out_id` 반환됨
   - **결과**: 데이터 매핑 실패 ❌

3. **transaction_type 필터 누락**
   - 판매/사용 데이터가 섞여서 표시됨

---

## ✅ 해결 방법

### Supabase SQL Editor에서 순서대로 실행:

#### 1단계: get_sales_list 함수 정리
```sql
-- database/fix_get_sales_list_final.sql 실행
```

**변경 내용**:
- ✅ UUID 버전 함수 **삭제**
- ✅ TEXT 버전에 `p_transaction_type` 파라미터 추가
- ✅ 반환 컬럼: `id`, `sale_date` (out_ 접두사 없음)
- ✅ 지점 격리 및 권한 검증

#### 2단계: get_sales_report 함수 수정
```sql
-- database/fix_sales_report_filter.sql 실행
```

**변경 내용**:
- ✅ `p_transaction_type` 파라미터 추가
- ✅ 모든 WHERE 절에 transaction_type 필터 추가

---

## 📊 수정 전/후 비교

### get_sales_list 함수

#### 수정 전 (문제)
```sql
-- 버전 1: TEXT 타입
CREATE FUNCTION get_sales_list(TEXT, DATE, DATE, TEXT)
RETURNS TABLE (
  id TEXT,
  sale_date DATE,
  -- ... transaction_type 없음
)

-- 버전 2: UUID 타입 (문제!)
CREATE FUNCTION get_sales_list(UUID, DATE, DATE, UUID, TEXT)
RETURNS TABLE (
  out_id TEXT,        -- ❌ out_ 접두사!
  out_sale_date DATE, -- ❌ out_ 접두사!
  -- ...
)
```

#### 수정 후 (정상)
```sql
-- TEXT 버전만 존재 (UUID 버전 삭제)
CREATE FUNCTION get_sales_list(TEXT, DATE, DATE, TEXT, TEXT)
RETURNS TABLE (
  id TEXT,              -- ✅ 정상
  sale_date DATE,       -- ✅ 정상
  -- ...
  transaction_type TEXT -- ✅ 추가
)
WHERE 
  -- ...
  AND (p_transaction_type IS NULL OR COALESCE(s.transaction_type, 'SALE') = p_transaction_type)
```

---

## 🧪 테스트 시나리오

### 1. 함수 목록 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_sales_list';
```

**예상 결과**:
```
function_name   | arguments
----------------|----------------------------------------------------------
get_sales_list  | p_branch_id text DEFAULT NULL::text, 
                  p_start_date date DEFAULT NULL::date, 
                  p_end_date date DEFAULT NULL::date, 
                  p_user_id text DEFAULT NULL::text, 
                  p_transaction_type text DEFAULT NULL::text
```

✅ **1개만 존재**해야 함!

### 2. 판매 데이터 조회 테스트
```sql
-- SALE 데이터 조회
SELECT COUNT(*) AS sale_count 
FROM get_sales_list(NULL, NULL, NULL, NULL, 'SALE');
```

**예상 결과**: 45건 (현재 DB 상태)

### 3. 사용 데이터 조회 테스트
```sql
-- USAGE 데이터 조회
SELECT COUNT(*) AS usage_count 
FROM get_sales_list(NULL, NULL, NULL, NULL, 'USAGE');
```

**예상 결과**: 1건 (현재 DB 상태)

### 4. 전체 데이터 조회 테스트
```sql
-- 모든 데이터 조회 (transaction_type NULL)
SELECT COUNT(*) AS total_count 
FROM get_sales_list(NULL, NULL, NULL, NULL, NULL);
```

**예상 결과**: 46건 (45 SALE + 1 USAGE)

---

## 📂 실행할 SQL 파일 (순서대로)

### 필수 실행

| 순서 | 파일 | 목적 | 상태 |
|------|------|------|------|
| 1 | `fix_get_sales_list_final.sql` | get_sales_list 함수 정리 | ⏳ 대기 |
| 2 | `fix_sales_report_filter.sql` | get_sales_report 함수 수정 | ⏳ 대기 |

---

## 🎯 기대 효과

### 수정 전 (문제)
```
Server Actions: UUID로 RPC 호출
    ↓
PostgreSQL: UUID 버전 함수 선택
    ↓
반환: { out_id, out_sale_date, ... }
    ↓
클라이언트: item.id, item.sale_date 접근 시도
    ↓
결과: undefined (데이터 매핑 실패) ❌
```

### 수정 후 (정상)
```
Server Actions: TEXT로 RPC 호출
    ↓
PostgreSQL: TEXT 버전 함수 선택 (UUID 버전 삭제됨)
    ↓
반환: { id, sale_date, ..., transaction_type }
    ↓
클라이언트: item.id, item.sale_date 접근
    ↓
결과: 데이터 정상 표시 ✅
```

---

## 🔍 함수 시그니처 변경

### get_sales_list

```
변경 전:
  버전 1: get_sales_list(TEXT, DATE, DATE, TEXT)
  버전 2: get_sales_list(UUID, DATE, DATE, UUID, TEXT) ← 삭제!

변경 후:
  get_sales_list(TEXT, DATE, DATE, TEXT, TEXT)
                 └────────────────────────┘
                       5번째 파라미터 추가: p_transaction_type
```

### get_sales_report

```
변경 전: get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT)
변경 후: get_sales_report(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
                          └────────────────────────────────┘
                                 6번째 파라미터 추가: p_transaction_type
```

---

## 📋 실행 체크리스트

### Supabase SQL Editor

- [ ] 1. `fix_get_sales_list_final.sql` 실행
  - [ ] ✅ UUID 버전 함수 삭제 확인
  - [ ] ✅ TEXT 버전 함수 생성 확인
  - [ ] ✅ 함수 목록에 1개만 존재 확인

- [ ] 2. `fix_sales_report_filter.sql` 실행
  - [ ] ✅ get_sales_report 함수 재생성 확인

### 프론트엔드 (이미 완료)

- [x] `app/sales/actions.ts` - saveSales 수정
- [x] `app/sales/actions.ts` - getSalesHistory 수정
- [x] `app/reports/sales/actions.ts` - SALE 필터 추가

---

## 🧪 최종 검증

### 1. 판매 페이지 테스트
1. `/sales` 접속
2. 판매 내역 로딩 확인
3. **결과**: SALE 데이터만 표시 ✅

### 2. 사용 페이지 테스트
1. `/usage` 접속
2. 사용 내역 로딩 확인
3. **결과**: USAGE 데이터만 표시 ✅

### 3. 판매 레포트 테스트
1. `/reports/sales` 접속
2. 조회 버튼 클릭
3. **결과**: SALE 데이터만 집계 ✅

### 4. 재료비 레포트 테스트
1. `/reports/usage` 접속
2. 조회 버튼 클릭
3. **결과**: USAGE 데이터만 집계 ✅

---

## 🎉 완료 기준

### ✅ DB 함수 상태
- [ ] `get_sales_list`: TEXT 버전 1개만 존재
- [ ] `get_sales_report`: transaction_type 파라미터 지원

### ✅ 프론트엔드 상태
- [x] 빌드 성공 (TypeScript 에러 0개)
- [x] transaction_type 파라미터 전달

### ✅ 기능 테스트
- [ ] 판매 입력 → DB에 'SALE' 저장
- [ ] 사용 입력 → DB에 'USAGE' 저장
- [ ] 판매 내역 → SALE만 표시
- [ ] 사용 내역 → USAGE만 표시
- [ ] 판매 레포트 → SALE만 집계
- [ ] 재료비 레포트 → USAGE만 집계

---

## 🚨 주의사항

### Server Actions의 RPC 호출 방식

현재 `app/sales/actions.ts`에서:

```typescript
const { data, error } = await supabase.rpc('get_sales_list', {
  p_branch_id: branchId,        // string | null
  p_start_date: startDate,      // string | undefined
  p_end_date: endDate,          // string | undefined
  p_user_id: userId,            // string
  p_transaction_type: transactionType || null
})
```

**중요**: 모든 파라미터가 TEXT로 전달되므로, RPC 함수도 TEXT 타입으로 받아야 함!

---

## 📊 데이터베이스 현황 (실행 전)

| 항목 | 수량 |
|------|------|
| SALE 데이터 | 45건 |
| USAGE 데이터 | 1건 |
| 총 sales 레코드 | 46건 |
| get_sales_list 함수 | 2개 (문제!) |
| get_sales_report 함수 | 1개 |

---

**작업 시작일**: 2025-01-26  
**빌드 상태**: ✅ 성공  
**DB 적용**: ⏳ 대기 중 (2개 SQL 파일 실행 필요)  
**예상 소요 시간**: 5분

