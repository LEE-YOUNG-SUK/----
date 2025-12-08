# ✅ 종합 레포트 구현 완료

## 📅 작업 일시
**2025-01-26 완료** ✅

---

## 🎯 목적

**이익 레포트 → 종합 레포트**로 변경하여 구매/사용/판매를 한눈에 볼 수 있도록 개선

---

## 📊 변경 내용

### 1️⃣ **메뉴명 변경**
- 기존: 📈 이익 레포트
- 변경: 📊 종합 레포트

### 2️⃣ **표시 컬럼**

| 컬럼명 | 설명 | 데이터 소스 | 색상 |
|--------|------|-------------|------|
| **구분** | 일자 또는 월 | group_label | 검정 (굵게) |
| **구매금액** | 입고 총액 | purchases.total_cost 합계 | 파란색 (#3B82F6) |
| **사용금액** | 내부사용 총액 | sales (USAGE) total_price 합계 | 주황색 (#F59E0B) |
| **판매금액** | 판매 총액 | sales (SALE) total_price 합계 | 초록색 (#10B981, 굵게) |
| **판매원가** | 판매 원가 | sales (SALE) cost_of_goods_sold 합계 | 회색 (#6B7280) |
| **판매이익** | 판매금액 - 판매원가 | sales (SALE) profit 합계 | 초록색/빨간색 (굵게) |
| **이익률** | (판매이익/판매금액) × 100 | 계산 | 보라색 (#8B5CF6, 굵게) |

### 3️⃣ **요약 카드**

| 카드 | 내용 | 색상 |
|------|------|------|
| 총 구매금액 | purchase_amount 합계 | primary (파란색) |
| 총 사용금액 | usage_amount 합계 | warning (주황색) |
| 총 판매금액 | sale_amount 합계 | success (초록색) |
| 총 판매이익 | sale_profit 합계 | success (초록색) |

---

## 🗄️ 데이터베이스 변경

### 새로운 RPC 함수: `get_summary_report`

**파일**: `database/create_summary_report.sql` ✅

**함수 시그니처**:
```sql
get_summary_report(
  p_user_role TEXT,
  p_branch_id TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_group_by TEXT DEFAULT 'daily'
)
```

**반환 컬럼**:
- `group_key` TEXT
- `group_label` TEXT
- `purchase_amount` NUMERIC (구매금액)
- `usage_amount` NUMERIC (사용금액)
- `sale_amount` NUMERIC (판매금액)
- `sale_cost` NUMERIC (판매원가)
- `sale_profit` NUMERIC (판매이익)
- `profit_margin` NUMERIC (이익률, %)

**처리 로직**:
1. CTE로 구매/사용/판매 데이터를 각각 집계
2. `all_periods`로 모든 기간 통합
3. LEFT JOIN으로 데이터 결합
4. 이익률 계산 (sale_profit / sale_amount × 100)

---

## 📂 수정된 파일

### 1. Server Actions
**파일**: `app/reports/profit/actions.ts` ✅

**변경 내용**:
- `getSummaryReport()` 함수 추가
- `SummaryReportRow` 인터페이스 정의
- `get_summary_report` RPC 호출
- 하위 호환성을 위해 `getProfitReport = getSummaryReport` 별칭 추가

### 2. 클라이언트 컴포넌트
**파일**: `app/reports/profit/ProfitReportClient.tsx` ✅

**변경 내용**:
- 컬럼 정의 변경 (7개 컬럼)
- 색상 코드 적용
- 요약 카드 변경 (4개)
- 안내 메시지 변경

### 3. 페이지
**파일**: `app/reports/profit/page.tsx` ✅

**변경 내용**:
- metadata: '종합 레포트'
- 페이지 제목: '📊 종합 레포트'
- 설명: '구매, 사용(내부소모), 판매 현황을 한눈에 확인합니다'

### 4. 네비게이션
**파일**: `components/shared/Navigation.tsx` ✅

**변경 내용**:
```typescript
// 기존
{ href: '/reports/profit', label: '이익', icon: '📈' }

// 변경
{ href: '/reports/profit', label: '종합', icon: '📊' }
```

---

## 🎨 UI 디자인

### 컬럼 색상 코드

```typescript
{
  headerName: '구매금액',
  cellStyle: () => ({ color: '#3B82F6' }),  // 파란색
}
{
  headerName: '사용금액',
  cellStyle: () => ({ color: '#F59E0B' }),  // 주황색
}
{
  headerName: '판매금액',
  cellStyle: () => ({ color: '#10B981', fontWeight: 'bold' }),  // 초록색
}
{
  headerName: '판매원가',
  cellStyle: () => ({ color: '#6B7280' }),  // 회색
}
{
  headerName: '판매이익',
  cellStyle: (params) => ({
    fontWeight: 'bold',
    color: params.value >= 0 ? '#10B981' : '#DC2626',  // 초록/빨강
  }),
}
{
  headerName: '이익률',
  cellStyle: (params) => ({
    fontWeight: 'bold',
    color: params.value >= 0 ? '#8B5CF6' : '#DC2626',  // 보라/빨강
  }),
}
```

### 요약 카드

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 총 구매금액  │ │ 총 사용금액  │ │ 총 판매금액  │ │ 총 판매이익  │
│ ₩5,000,000  │ │ ₩1,500,000  │ │ ₩8,000,000  │ │ ₩2,000,000  │
│   (파란색)   │ │   (주황색)   │ │   (초록색)   │ │   (초록색)   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 🧪 데이터 흐름

```
Supabase RPC: get_summary_report
    ↓
CTE 1: purchase_data
  - purchases 테이블에서 기간별 구매금액 집계
    ↓
CTE 2: usage_data
  - sales 테이블 (transaction_type='USAGE')에서 사용금액 집계
    ↓
CTE 3: sale_data
  - sales 테이블 (transaction_type='SALE')에서 판매 데이터 집계
  - sale_amount, sale_cost, sale_profit
    ↓
CTE 4: all_periods
  - 모든 기간 UNION (구매/사용/판매 발생 기간)
    ↓
LEFT JOIN으로 결합
  - all_periods + purchase_data + usage_data + sale_data
    ↓
이익률 계산
  - profit_margin = (sale_profit / sale_amount) * 100
    ↓
반환: SummaryReportRow[]
    ↓
ProfitReportClient에서 렌더링
```

---

## 📊 예시 데이터

### 일별 그룹핑

| 구분 | 구매금액 | 사용금액 | 판매금액 | 판매원가 | 판매이익 | 이익률 |
|------|----------|----------|----------|----------|----------|--------|
| 2025-01-26 | ₩1,000,000 | ₩200,000 | ₩2,500,000 | ₩1,800,000 | ₩700,000 | 28.0% |
| 2025-01-25 | ₩800,000 | ₩150,000 | ₩2,000,000 | ₩1,500,000 | ₩500,000 | 25.0% |
| 2025-01-24 | ₩500,000 | ₩100,000 | ₩1,500,000 | ₩1,100,000 | ₩400,000 | 26.7% |

### 월별 그룹핑

| 구분 | 구매금액 | 사용금액 | 판매금액 | 판매원가 | 판매이익 | 이익률 |
|------|----------|----------|----------|----------|----------|--------|
| 2025년 01월 | ₩15,000,000 | ₩3,000,000 | ₩25,000,000 | ₩18,000,000 | ₩7,000,000 | 28.0% |
| 2024년 12월 | ₩12,000,000 | ₩2,500,000 | ₩20,000,000 | ₩15,000,000 | ₩5,000,000 | 25.0% |

---

## 🔍 Supabase에서 실행할 SQL

### 1단계: 함수 생성

**파일 경로**: `database/create_summary_report.sql`

```sql
-- Supabase SQL Editor에서 전체 파일 내용 복사 → 실행
```

**예상 출력**:
```
✅ get_summary_report 함수 생성 완료!
```

### 2단계: 테스트 쿼리

```sql
SELECT * FROM get_summary_report(
  '0000',  -- user_role
  '',      -- branch_id (전체)
  (CURRENT_DATE - INTERVAL '30 days')::TEXT,
  CURRENT_DATE::TEXT,
  'daily'
)
LIMIT 5;
```

**예상 결과**:
```
group_key  | group_label | purchase_amount | usage_amount | sale_amount | sale_cost | sale_profit | profit_margin
-----------|-------------|-----------------|--------------|-------------|-----------|-------------|---------------
2025-01-26 | 2025-01-26  |     1000000     |    200000    |   2500000   |  1800000  |    700000   |     28.00
2025-01-25 | 2025-01-25  |      800000     |    150000    |   2000000   |  1500000  |    500000   |     25.00
```

---

## 🎯 테스트 시나리오

### 1. 일별 그룹핑 테스트
1. `/reports/profit` 접속
2. 그룹핑: "일별" 선택
3. 기간: 최근 7일
4. 조회 버튼 클릭
5. **확인사항**:
   - ✅ 구매금액이 표시됨
   - ✅ 사용금액이 표시됨
   - ✅ 판매금액이 표시됨
   - ✅ 이익률이 계산됨

### 2. 월별 그룹핑 테스트
1. 그룹핑: "월별" 선택
2. 기간: 최근 6개월
3. 조회 버튼 클릭
4. **확인사항**:
   - ✅ "2025년 01월" 형식으로 표시
   - ✅ 월별로 데이터 집계됨

### 3. 요약 카드 테스트
1. 레포트 조회 후 하단 확인
2. **확인사항**:
   - ✅ 총 구매금액 = 테이블의 purchase_amount 합계
   - ✅ 총 사용금액 = 테이블의 usage_amount 합계
   - ✅ 총 판매금액 = 테이블의 sale_amount 합계
   - ✅ 총 판매이익 = 테이블의 sale_profit 합계

### 4. 지점 필터 테스트 (시스템 관리자)
1. 로그인: 시스템 관리자 계정
2. 지점 선택: "강남점"
3. 조회 버튼 클릭
4. **확인사항**:
   - ✅ 강남점 데이터만 표시

---

## 📋 기존 이익 레포트와 비교

| 항목 | 기존 (이익 레포트) | 변경 (종합 레포트) |
|------|-------------------|-------------------|
| **페이지 제목** | 📈 이익 레포트 | 📊 종합 레포트 |
| **표시 데이터** | 판매 데이터만 | 구매 + 사용 + 판매 |
| **컬럼 수** | 6개 | 7개 |
| **요약 카드** | 4개 (매출, 원가, 이익, 이익률) | 4개 (구매, 사용, 판매, 이익) |
| **RPC 함수** | `get_profit_report` | `get_summary_report` |
| **그룹핑** | 일별/월별 | 일별/월별 |

---

## ✅ 완료 체크리스트

### 데이터베이스
- [x] `get_summary_report` 함수 생성
- [x] 구매/사용/판매 데이터 집계 로직
- [x] 이익률 계산 로직
- [x] 권한 체크 (원장/매니저 이상)

### 프론트엔드
- [x] `actions.ts` - getSummaryReport 함수
- [x] `ProfitReportClient.tsx` - 컬럼 및 UI 변경
- [x] `page.tsx` - 제목 및 메타데이터 변경
- [x] `Navigation.tsx` - 메뉴명 변경

### 빌드 및 테스트
- [x] TypeScript 빌드 성공
- [x] 타입 에러 0개
- [ ] Supabase SQL 실행 (사용자 작업 필요)
- [ ] 실제 데이터로 테스트

---

## 🚀 배포 순서

### 1단계: Supabase (Production)
```sql
-- database/create_summary_report.sql 전체 실행
```

### 2단계: Next.js (Production)
```bash
# 이미 빌드 완료 ✅
npm run build  # 성공
```

### 3단계: 배포
- Vercel/서버에 배포
- 브라우저 캐시 클리어 (Ctrl + Shift + R)

---

## 💡 참고사항

### 안내 메시지
```
💡 참고: 구매금액은 입고 비용, 사용금액은 내부소모 재료비, 판매금액은 고객 판매 수익을 나타냅니다. 
이익률은 판매이익/판매금액으로 계산됩니다.
```

### 이익률 계산식
```
이익률 = (판매이익 / 판매금액) × 100
      = ((판매금액 - 판매원가) / 판매금액) × 100
```

### 데이터 정합성
- 구매금액: `purchases` 테이블에서 직접 집계
- 사용금액: `sales` 테이블 (transaction_type='USAGE')
- 판매금액: `sales` 테이블 (transaction_type='SALE')

---

**작업 완료일**: 2025-01-26  
**빌드 상태**: ✅ 성공  
**DB 적용**: ⏳ 대기 중 (`create_summary_report.sql` 실행 필요)  
**변경 영향**: 기존 이익 레포트 경로는 유지되며 종합 레포트로 변경됨

