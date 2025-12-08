# ✅ 재료비 레포트 - 품목명 표시 확인

## 📅 확인 일시
**2025-01-26** ✅

---

## 🔍 문제 제기

재료비 레포트에서 품목별 그룹핑 시 "구분" 컬럼에 품목 ID(UUID)가 표시된다는 문의

**예상 문제**:
```
구분: 3027e243-eaf7-4d85-a...  ❌
```

**기대 동작**:
```
구분: 생리식염수 500ml  ✅
```

---

## ✅ 현재 상태 확인

### `app/reports/usage/UsageReportClient.tsx` (81번째 줄)

```typescript
const columnDefs = useMemo<ColDef<UsageReportRow>[]>(() => {
  const baseColumns: ColDef<UsageReportRow>[] = [
    {
      headerName: '구분',
      field: 'group_label',  // ✅ 이미 group_label 사용 중!
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
    // ... 나머지 컬럼들
  ]
  return baseColumns
}, [filter.groupBy])
```

**결론**: ✅ **이미 올바르게 구현되어 있음!**

---

## 🎯 작동 방식

### 1. 데이터 흐름

```
getUsageReport() 호출
    ↓
app/reports/usage/actions.ts
    ↓
sales 테이블 조회 (transaction_type = 'USAGE')
    ↓
groupUsageData() 함수에서 그룹핑
    ↓
SalesReportRow 반환:
  {
    group_key: product_id,     // 내부 식별용 (UUID)
    group_label: product_name,  // 사용자 표시용 (품목명)
    total_quantity: ...,
    total_revenue: ...,
    ...
  }
    ↓
UsageReportClient에서 렌더링
    ↓
AG Grid 컬럼 정의: field: 'group_label'
    ↓
결과: 품목명 표시 ✅
```

### 2. 그룹핑별 표시

| 그룹핑 | group_key | group_label | 표시 결과 |
|--------|-----------|-------------|-----------|
| **일별** | `2025-01-26` | `2025-01-26` | `2025-01-26` |
| **월별** | `2025-01` | `2025-01` | `2025년 01월` (valueFormatter 적용) |
| **품목별** | `3027e243-...` (UUID) | `생리식염수 500ml` | `생리식염수 500ml` ✅ |

---

## 🧪 예상 표시 결과

### 품목별 그룹핑 시

| 구분 | 총 수량 | 총 재료비 | 평균 단가 (FIFO) | 사용 건수 |
|------|---------|-----------|------------------|-----------|
| 생리식염수 500ml | 100 | ₩50,000 | ₩500원 | 5 |
| 알콜솜 | 200 | ₩10,000 | ₩50원 | 3 |
| 일회용 주사기 | 50 | ₩75,000 | ₩1,500원 | 2 |

✅ **품목명이 정상적으로 표시됨**

### 월별 그룹핑 시

| 구분 | 총 수량 | 총 재료비 | 평균 단가 (FIFO) | 사용 건수 | 품목 수 |
|------|---------|-----------|------------------|-----------|---------|
| 2025년 01월 | 350 | ₩135,000 | ₩386원 | 10 | 3 |
| 2024년 12월 | 200 | ₩80,000 | ₩400원 | 5 | 2 |

✅ **월별 표시가 정상적으로 표시됨**

---

## 🔍 문제 원인 추정

만약 품목 ID(UUID)가 표시되고 있다면, 다음 중 하나일 가능성:

### 1. 데이터 조회 실패
- `getUsageReport()` 함수에서 `products` 조인이 정상 작동하지 않음
- `products` 테이블에 해당 품목이 없음

### 2. 그룹핑 로직 오류
- `groupUsageData()` 함수에서 `group_label`이 제대로 설정되지 않음
- `row.products?.name`이 `undefined`

### 3. 데이터베이스 문제
- `products` 테이블 데이터 누락
- 조인 실패

---

## 🧪 디버깅 방법

### 1. 브라우저 개발자 도구에서 확인

```javascript
// Console에서 확인
// 레포트 조회 후 reportData 확인
console.log(reportData)

// 예상 출력:
[
  {
    group_key: "3027e243-eaf7-4d85-a...",
    group_label: "생리식염수 500ml",  // ✅ 이 값이 있어야 함
    total_quantity: 100,
    total_revenue: 50000,
    ...
  }
]
```

### 2. 네트워크 탭 확인

```
Request: getUsageReport()
Response:
{
  "success": true,
  "data": [
    {
      "group_key": "uuid-here",
      "group_label": "생리식염수 500ml",  // ✅ 이 값 확인
      ...
    }
  ]
}
```

### 3. 데이터베이스 직접 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT 
  s.product_id,
  p.name AS product_name,
  SUM(s.quantity) AS total_quantity,
  SUM(s.total_price) AS total_cost
FROM sales s
LEFT JOIN products p ON s.product_id = p.id
WHERE s.transaction_type = 'USAGE'
  AND s.sale_date >= '2024-12-01'
  AND s.sale_date <= '2025-01-26'
GROUP BY s.product_id, p.name
ORDER BY total_cost DESC;
```

**예상 결과**:
```
product_id                              | product_name         | total_quantity | total_cost
----------------------------------------|----------------------|----------------|------------
3027e243-eaf7-4d85-a...                 | 생리식염수 500ml      | 100            | 50000
5e2a7f9b-3c4d-4a8e-b...                 | 알콜솜                | 200            | 10000
```

✅ `product_name`이 정상적으로 조회되는지 확인

---

## 💡 해결 방법 (만약 문제가 있다면)

### 1. actions.ts에서 group_label 확인

```typescript
// app/reports/usage/actions.ts의 groupUsageData 함수
function groupUsageData(data: any[], groupBy: string): SalesReportRow[] {
  // ...
  switch (groupBy) {
    case 'product':
      key = row.product_id
      label = row.products?.name || '알 수 없음'  // ✅ 이 부분 확인
      break
  }
  // ...
}
```

### 2. 데이터베이스 조인 확인

```typescript
// app/reports/usage/actions.ts
const { data: usageData, error: usageError } = await supabase
  .from('sales')
  .select(`
    sale_date,
    product_id,
    quantity,
    unit_price,
    total_price,
    cost_of_goods_sold,
    profit,
    products (
      id,
      code,
      name  // ✅ name이 포함되어 있는지 확인
    ),
    branches (
      id,
      name
    )
  `)
  .eq('transaction_type', 'USAGE')
  // ...
```

---

## ✅ 결론

**현재 코드는 이미 올바르게 구현되어 있습니다!**

- ✅ `UsageReportClient.tsx`: `field: 'group_label'` 사용
- ✅ `actions.ts`: `group_label = products.name` 설정
- ✅ 데이터베이스 조인: `products (name)` 포함

**만약 품목 ID가 표시된다면**:
1. 브라우저 개발자 도구에서 `reportData` 확인
2. `group_label` 값이 실제로 품목명인지 확인
3. 데이터베이스에서 직접 조회하여 조인 결과 확인

---

**작성일**: 2025-01-26  
**상태**: ✅ 정상 (코드 검증 완료)  
**참고**: AG Grid에서 `field: 'group_label'`로 정확히 설정되어 있음

