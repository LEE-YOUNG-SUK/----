# Phase 6: PostgreSQL RPC 함수 GROUP BY 에러 해결 가이드

## 작성일
2025-01-26

## 문제 상황

### 에러 메시지
```
column "p.purchase_date" must appear in the GROUP BY clause or be used in an aggregate function
```

### 원인 분석
PostgreSQL에서 `SELECT`에 있는 모든 컬럼은 `GROUP BY`에 포함되거나 집계 함수(SUM, COUNT 등)로 감싸져야 합니다.

#### 문제 코드 패턴
```sql
SELECT
  TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT AS group_key,
  TO_CHAR(p.purchase_date, 'YYYY년 MM월')::TEXT AS group_label,  -- ❌ 다른 포맷
  ...
GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM-DD')  -- group_label 포맷과 불일치
ORDER BY group_key DESC;  -- alias 참조 문제
```

**문제점:**
1. `group_key`와 `group_label`의 `TO_CHAR` 포맷이 다름 (한 개만 GROUP BY에 포함)
2. PostgreSQL은 `SELECT`의 모든 표현식이 `GROUP BY`에 정확히 일치해야 함
3. `ORDER BY`에서 alias 참조 시 모호성 발생 가능

---

## 해결 방법

### 1. AS alias 제거
`RETURNS TABLE`에서 이미 컬럼명이 정의되어 있으므로 `AS alias` 불필요

```sql
-- ❌ 변경 전
TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT AS group_key,

-- ✅ 변경 후
TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,
```

### 2. group_key와 group_label을 동일하게 변경
한글 포맷팅(`YYYY년 MM월`)을 제거하고 프론트엔드에서 처리

```sql
-- ❌ 변경 전
TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT AS group_key,
TO_CHAR(p.purchase_date, 'YYYY년 MM월')::TEXT AS group_label,

-- ✅ 변경 후
TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,  -- group_key
TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,  -- group_label (동일)
```

### 3. ORDER BY에 컬럼 번호 사용
Alias 대신 SELECT 절 컬럼 순서(1부터 시작) 사용

```sql
-- ❌ 변경 전
ORDER BY group_key DESC

-- ✅ 변경 후
ORDER BY 1 DESC  -- 첫 번째 컬럼 기준 정렬
```

---

## 수정된 패턴 예시

### daily 그룹핑
```sql
IF p_group_by = 'daily' THEN
  RETURN QUERY
  SELECT
    TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,
    TO_CHAR(p.purchase_date, 'YYYY-MM-DD')::TEXT,
    COALESCE(SUM(p.quantity), 0)::NUMERIC,
    COALESCE(SUM(p.total_cost), 0)::NUMERIC,
    COUNT(DISTINCT p.id)::INTEGER,
    CASE 
      WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
      ELSE 0::NUMERIC
    END,
    COUNT(DISTINCT p.product_id)::INTEGER
  FROM purchases p
  WHERE ...
  GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM-DD')
  ORDER BY 1 DESC;
```

### monthly 그룹핑
```sql
ELSIF p_group_by = 'monthly' THEN
  RETURN QUERY
  SELECT
    TO_CHAR(p.purchase_date, 'YYYY-MM')::TEXT,
    TO_CHAR(p.purchase_date, 'YYYY-MM')::TEXT,
    COALESCE(SUM(p.quantity), 0)::NUMERIC,
    COALESCE(SUM(p.total_cost), 0)::NUMERIC,
    COUNT(DISTINCT p.id)::INTEGER,
    CASE 
      WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
      ELSE 0::NUMERIC
    END,
    COUNT(DISTINCT p.product_id)::INTEGER
  FROM purchases p
  WHERE ...
  GROUP BY TO_CHAR(p.purchase_date, 'YYYY-MM')
  ORDER BY 1 DESC;
```

### product/supplier/customer 그룹핑
```sql
ELSIF p_group_by = 'product' THEN
  RETURN QUERY
  SELECT
    p.product_id::TEXT,
    prod.name::TEXT,
    COALESCE(SUM(p.quantity), 0)::NUMERIC,
    COALESCE(SUM(p.total_cost), 0)::NUMERIC,
    COUNT(DISTINCT p.id)::INTEGER,
    CASE 
      WHEN SUM(p.quantity) > 0 THEN (SUM(p.total_cost) / SUM(p.quantity))::NUMERIC
      ELSE 0::NUMERIC
    END,
    COUNT(DISTINCT p.product_id)::INTEGER
  FROM purchases p
  INNER JOIN products prod ON prod.id = p.product_id
  WHERE ...
  GROUP BY p.product_id, prod.name
  ORDER BY 4 DESC;  -- total_amount 기준 정렬
```

---

## 프론트엔드 한글 포맷팅

RPC에서 반환된 `group_label`을 클라이언트에서 한글로 변환합니다.

### 수정 파일
- `app/reports/purchases/PurchaseReportClient.tsx`
- `app/reports/sales/SalesReportClient.tsx`
- `app/reports/profit/ProfitReportClient.tsx`

### 코드 패턴
```typescript
const columnDefs = useMemo<ColDef<ReportRow>[]>(() => {
  const baseColumns: ColDef<ReportRow>[] = [
    {
      headerName: '구분',
      field: 'group_label',
      width: 200,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' },
      valueFormatter: (params) => {
        // monthly 그룹핑: 2025-01 → 2025년 01월
        if (filter.groupBy === 'monthly' && params.value?.match(/^\d{4}-\d{2}$/)) {
          const [year, month] = params.value.split('-')
          return `${year}년 ${month}월`
        }
        return params.value
      },
    },
    // ... 나머지 컬럼
  ]
  return baseColumns
}, [filter.groupBy])
```

---

## 핵심 규칙 요약

| 항목 | 규칙 | 예시 |
|------|------|------|
| SELECT 컬럼 | 모두 GROUP BY에 포함되거나 집계 함수 사용 | `TO_CHAR(date, 'YYYY-MM')` → GROUP BY에 동일하게 |
| group_key, group_label | 동일한 표현식 사용 (중복 가능) | `TO_CHAR(date, 'YYYY-MM')::TEXT` 2번 |
| GROUP BY | SELECT의 표현식과 정확히 일치 | `GROUP BY TO_CHAR(date, 'YYYY-MM')` |
| ORDER BY | 컬럼 번호 사용 (1, 2, 3...) | `ORDER BY 1 DESC`, `ORDER BY 4 DESC` |
| AS alias | RETURNS TABLE 정의 시 불필요, 제거 | `::TEXT` 만 사용 |
| 한글 포맷팅 | 프론트엔드에서 처리 | AG Grid의 `valueFormatter` 활용 |

---

## 적용 범위

### 수정된 RPC 함수
1. `get_purchase_report()` - 4가지 그룹핑 (daily, monthly, product, supplier)
2. `get_sales_report()` - 4가지 그룹핑 (daily, monthly, product, customer)
3. `get_profit_report()` - 2가지 그룹핑 (daily, monthly)

### 테스트 쿼리
```sql
-- 구매 레포트 (월별)
SELECT * FROM get_purchase_report('0001', NULL, '2024-01-01', '2024-12-31', 'monthly');

-- 판매 레포트 (품목별)
SELECT * FROM get_sales_report('0001', NULL, '2024-01-01', '2024-12-31', 'product');

-- 이익 레포트 (일별)
SELECT * FROM get_profit_report('0001', NULL, '2024-01-01', '2024-12-31', 'daily');
```

---

## 배포 가이드

### 1. Supabase SQL Editor 배포
```bash
# phase6_reports_rpc_functions.sql 전체 실행
# DROP FUNCTION IF EXISTS로 기존 함수 제거 후 재생성
```

### 2. 프론트엔드 배포
```bash
npm run build
```

### 3. 검증
- UI에서 월별 레포트 조회 시 "2025년 01월" 형식으로 표시되는지 확인
- 모든 그룹핑 옵션(일별/월별/품목별/공급처별/고객별) 테스트
- 빈 데이터, 대량 데이터 모두 정상 작동 확인

---

## 참고 문헌

### PostgreSQL 공식 문서
- [SELECT 문 GROUP BY 절](https://www.postgresql.org/docs/current/sql-select.html#SQL-GROUPBY)
- [집계 함수 (Aggregate Functions)](https://www.postgresql.org/docs/current/functions-aggregate.html)

### 프로젝트 문서
- `database/phase6_reports_rpc_functions.sql` - 최종 수정 버전
- `.github/copilot-instructions.md` - 데이터베이스 문제 해결 가이드
- `database/PHASE5_HANDOVER.md` - UUID 타입 이슈 참고

---

## 교훈 (Lessons Learned)

1. **PostgreSQL GROUP BY 엄격성**: MySQL보다 GROUP BY 제약이 엄격함. SELECT의 모든 비집계 컬럼은 GROUP BY에 정확히 일치해야 함.

2. **한글 포맷팅 위치**: DB에서 한글 처리 시 인코딩/정렬 이슈 발생 가능. 프론트엔드에서 처리하는 것이 안전.

3. **ORDER BY alias 위험성**: Complex query에서 alias 사용 시 모호성 발생. 컬럼 번호 사용이 명확함.

4. **RETURNS TABLE의 역할**: 이미 컬럼명을 정의하므로 SELECT에서 `AS alias` 중복 불필요.

5. **실제 배포 테스트의 중요성**: 로컬 PostgreSQL과 Supabase 환경에서 동작이 다를 수 있음. 실제 환경 테스트 필수.
