# Phase 6: 판매 내역 그룹화 및 부가세 로직 개선 - 인수인계서

**작성일**: 2025-12-04  
**상태**: Phase 6 완료 (판매 내역 그룹화 + 부가세 계산 로직 개선)  
**다음 작업**: Phase 7 (아래 참고)

---

## 📊 전체 진행 현황

### Phase 별 완료도
- ✅ **Phase 0**: 데이터베이스 초기 설정 (세션, 사용자, 거래처 등)
- ✅ **Phase 1**: 배치 처리 및 권한 관리 시스템
- ✅ **Phase 2**: 권한 검증 및 감시 로그
- ✅ **Phase 3**: 감시 로그 시스템 완성
- ✅ **Phase 3.5**: 필드명 매핑 및 타입 캐스팅 수정
- ✅ **Phase 4**: 입고/판매 부가세 기능 구현
- ✅ **Phase 5**: 재고 조정 시스템 완성
- ✅ **Phase 6**: 판매 내역 그룹화 및 부가세 로직 개선 **← 현재**
- ⏳ **Phase 7**: [다음 작업 계획]

---

## 🎯 Phase 6 핵심 완료 작업

### 1️⃣ 판매 내역 그룹화 (입고 내역과 동일한 UX)

#### A. 타입 정의 완료
**파일**: `types/sales.ts`
```typescript
export interface SaleGroup {
  reference_number: string          // 거래번호 (그룹 키)
  sale_date: string                 // 판매일
  customer_name: string             // 거래처명
  items: SaleHistory[]              // 판매 품목 배열
  total_amount: number              // 그룹 총 판매액
  total_items: number               // 품목 수
  first_product_name: string        // 첫 번째 품목명 (리스트 요약용)
}
```

#### B. 프론트엔드 컴포넌트 완성
**파일**: `components/sales/salehistorytable.tsx` (380줄)
- 거래번호 기준 그룹화
- 날짜 필터 (시작일/종료일 + 빠른 선택: 오늘/이번주/이번달)
- 반응형 레이아웃 (모바일/테블릿/데스크탑)
- 7개 열: 거래번호 | 판매일 | 거래처 | 품목명 | 품목 수 | 총 판매액 | 상세

**파일**: `components/sales/SaleDetailModal.tsx` (210줄)
- 거래번호별 판매 품목 상세 모달
- 개별 편집/삭제 기능 (향후 확장용)
- 통계 정보: 품목 수, 총 판매액, 총 이익

#### C. 데이터 페칭 로직 수정
**파일**: `app/sales/actions.ts` - `getSalesHistory()` 함수
```typescript
// 필드 매핑 수정
{
  total_amount: item.total_amount || 0,        // ✅ RPC: total_price → total_amount (별칭)
  cost_of_goods: item.cost_of_goods || 0,      // ✅ RPC: cost_of_goods_sold → cost_of_goods
  customer_name: item.customer_name || '',      // ✅ RPC: client_name → customer_name
  profit_margin: item.total_amount > 0 ? 
    Math.round((item.total_amount - item.cost_of_goods) / item.total_amount * 100) : 0
}
```

### 2️⃣ RPC 함수 수정 (get_sales_list)

**파일**: `database/purchases_sales_rpc_functions.sql`

#### 문제 원인
- RPC 함수에서 `total_amount` 별칭을 사용하지 않음
- VARCHAR 필드를 TEXT로 변환하지 않음
- INTEGER 필드를 NUMERIC으로 캐스팅하지 않음

#### 해결 내용
```sql
CREATE OR REPLACE FUNCTION get_sales_list(
  p_branch_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_user_id TEXT
)
RETURNS TABLE (
  id TEXT,
  reference_number TEXT,
  sale_date TEXT,
  quantity NUMERIC,                    -- ✅ INTEGER → NUMERIC
  unit_price NUMERIC,
  total_amount NUMERIC,                -- ✅ total_price AS total_amount (별칭)
  cost_of_goods NUMERIC,               -- ✅ cost_of_goods_sold AS cost_of_goods
  profit NUMERIC,
  branch_name TEXT,                    -- ✅ VARCHAR → TEXT
  customer_name TEXT,                  -- ✅ client_name AS customer_name (별칭)
  product_code TEXT,                   -- ✅ VARCHAR → TEXT
  product_name TEXT,                   -- ✅ VARCHAR → TEXT
  created_by TEXT
)
```

**핵심 SELECT 절**:
```sql
s.id::TEXT,
s.reference_number::TEXT,
s.sale_date::TEXT,
s.quantity::NUMERIC,                           -- 타입 명시
s.unit_price,
s.total_price AS total_amount,                 -- ✅ 별칭 추가
COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods,  -- ✅ 별칭 추가
COALESCE(s.profit, 0),
b.name::TEXT AS branch_name,                   -- ✅ TEXT 캐스팅
c.name::TEXT AS customer_name,                 -- ✅ 별칭 + TEXT 캐스팅
pr.code::TEXT,
pr.name::TEXT,
s.created_by::TEXT
```

### 3️⃣ AG Grid 에러 해결

**파일**: `components/sales/salegrid.tsx`

#### 문제
- Grid 파괴 중 `refreshCells()` 호출 시 에러 발생
- 페이지 새로고침 시 Grid가 언마운트되는데 비동기 콜백 실행

#### 해결
```typescript
// handleProductSelect 함수 (138-145줄)
setTimeout(() => {
  try {
    if (gridRef.current?.api && rowNode?.data) {
      gridRef.current.api.refreshCells({
        rowNodes: [rowNode],
        columns: ['supply_price', 'tax_amount', 'total_price'],
        force: true
      })
    }
  } catch (e) {
    // 페이지 새로고침 중 Grid 파괴 에러 무시
  }
}, 0)

// onCellValueChanged 함수 (297-312줄)
try {
  if (params.api && params.node) {
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['supply_price', 'tax_amount', 'total_price']
    })
  }
} catch (e) {
  // 에러 무시
}
```

### 4️⃣ 입고 관리 부가세 로직 개선

**파일**: `components/purchases/PurchaseGrid.tsx` - `calculatePrices()` 함수

#### 문제
부가세 미포함 모드에서 입력한 단가를 부가세 포함으로 자동 변환하여 재고에 저장하지 않음

#### 해결 (2025-12-04 완료)
```typescript
function calculatePrices(row: PurchaseGridRow, isTaxIncluded: boolean) {
  const quantity = row.quantity || 0
  const inputUnitCost = row.unit_cost || 0  // 사용자가 입력한 단가
  
  if (isTaxIncluded) {
    // 부가세 포함: 수량 * 단가 = 합계
    const totalPrice = quantity * inputUnitCost
    const supplyPrice = Math.round(totalPrice / 1.1)
    const taxAmount = totalPrice - supplyPrice
    
    row.total_price = totalPrice
    row.supply_price = supplyPrice
    row.tax_amount = taxAmount
    row.total_cost = totalPrice
    // unit_cost는 그대로 유지
  } else {
    // 부가세 미포함: 수량 * 단가 = 공급가
    const supplyPrice = quantity * inputUnitCost
    const taxAmount = Math.round(supplyPrice * 0.1)
    const totalPrice = supplyPrice + taxAmount
    
    row.supply_price = supplyPrice
    row.tax_amount = taxAmount
    row.total_price = totalPrice
    row.total_cost = totalPrice
    
    // ✅ 핵심: unit_cost를 부가세 포함 단가로 변환 (재고 저장용)
    // 입력 단가 × 1.1 = 부가세 포함 단가
    row.unit_cost = Math.round(inputUnitCost * 1.1)
  }
}
```

**비즈니스 로직 설명**:
- **부가세 포함 모드**: 입력 11,000 → 재고 11,000 저장
- **부가세 미포함 모드**: 입력 10,000 → 재고 11,000 저장 (자동 변환)
- 재고현황에서 **항상 부가세 포함 금액** 표시
- FIFO 원가 계산의 정확성 유지

---

## 🔧 데이터베이스 구조 (현재 상태)

### 핵심 테이블

#### `purchases` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID                    -- 지점
client_id UUID                    -- 공급업체
product_id UUID                   -- 품목
purchase_date DATE                -- 입고일
quantity NUMERIC(15, 4)          -- 수량
unit_cost NUMERIC(15, 2)         -- 단가 (사용자 입력)
supply_price NUMERIC(15, 2)      -- 공급가 (부가세 제외)
tax_amount NUMERIC(15, 2)        -- 부가세
total_price NUMERIC(15, 2)       -- 합계
total_cost NUMERIC(15, 2)        -- = total_price (호환성)
reference_number TEXT            -- 거래번호
notes TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

#### `sales` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID                    -- 지점
client_id UUID                    -- 고객
product_id UUID                   -- 품목
sale_date DATE                    -- 판매일
quantity NUMERIC(15, 4)          -- 수량
unit_price NUMERIC(15, 2)        -- 단가
supply_price NUMERIC(15, 2)      -- 공급가
tax_amount NUMERIC(15, 2)        -- 부가세
total_price NUMERIC(15, 2)       -- 합계
total_cost NUMERIC(15, 2)        -- = total_price
cost_of_goods_sold NUMERIC(15, 2) -- FIFO 원가
profit NUMERIC(15, 2)            -- 이익
reference_number TEXT
notes TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

#### `inventory_layers` 테이블
```sql
id UUID PRIMARY KEY
branch_id UUID
product_id UUID
purchase_date DATE
quantity NUMERIC(15, 4)         -- 초기 수량
remaining_quantity NUMERIC(15, 4) -- 남은 수량 (차감 추적)
unit_cost NUMERIC(15, 2)        -- 단가 (부가세 포함)
source_type TEXT                -- 'PURCHASE', 'ADJUSTMENT'
source_id TEXT                  -- 구매/조정 ID
created_at TIMESTAMPTZ
```

---

## 📝 RPC 함수 목록

### 판매/입고 관련 RPC (Phase 4-6)
| 함수명 | 용도 | 파라미터 | 반환 |
|--------|------|---------|------|
| `get_sales_list()` | 판매 내역 조회 | branch_id, start_date, end_date, user_id | TABLE (판매 데이터) |
| `get_purchases_list()` | 입고 내역 조회 | branch_id, start_date, end_date, user_id | TABLE (입고 데이터) |
| `process_sale_with_fifo()` | 판매 처리 (FIFO) | branch_id, client_id, product_id, quantity, unit_price, supply_price, tax_amount, total_price, sale_date, created_by | success, message |
| `process_purchase_with_layers()` | 입고 처리 | branch_id, client_id, product_id, quantity, unit_cost, supply_price, tax_amount, total_price, purchase_date, created_by | success, message |

### 재고 조정 RPC (Phase 5)
| 함수명 | 용도 | 파라미터 | 반환 |
|--------|------|---------|------|
| `process_inventory_adjustment()` | 재고 조정 | branch_id, product_id, adjustment_type, quantity, reason, created_by | success, message |
| `get_inventory_adjustments()` | 조정 내역 조회 | branch_id, user_id | TABLE (조정 데이터) |
| `cancel_inventory_adjustment()` | 조정 취소 | adjustment_id, user_id | success, message |

---

## 🎨 프론트엔드 컴포넌트 변화

### 입고 관리 (`app/purchases/`)
```
✅ 완료:
- PurchaseForm.tsx: 부가세 드롭박스 + 자동계산
- PurchaseGrid.tsx: 7열 레이아웃 + calculatePrices 개선
- PurchaseHistoryTable.tsx: 거래번호 그룹화 (Phase 4)
- app/purchases/page.tsx: 세션 검증 + 데이터 페칭
- app/purchases/actions.ts: 6개 Server Actions
```

### 판매 관리 (`app/sales/`) **← Phase 6 신규**
```
✅ Phase 6 완료:
- salehistorytable.tsx: 거래번호 그룹화 (380줄)
- SaleDetailModal.tsx: 상세 모달 (210줄)
- app/sales/actions.ts: getSalesHistory() 필드 매핑 수정
- salegrid.tsx: try-catch 에러 처리 추가

재사용된 패턴 (입고와 동일):
- SaleGroup 인터페이스 (PurchaseGroup과 동일)
- 날짜 필터 UI (입고와 동일)
- 반응형 레이아웃 (입고와 동일)
```

### 재고 조정 (`app/inventory-adjustments/`)
```
✅ 완료:
- AdjustmentForm.tsx: INCREASE/DECREASE 선택
- AdjustmentHistoryTable.tsx: 조정 내역 테이블
- AdjustmentStats.tsx: 통계 카드
- app/inventory-adjustments/actions.ts: 6개 함수
```

---

## 🚀 테스트 체크리스트

### Phase 6 검증 사항

#### A. 판매 내역 그룹화
- [ ] 판매 목록 페이지 접근 → 거래번호별 그룹화 확인
- [ ] 날짜 필터 동작 (시작일/종료일 입력)
- [ ] 빠른 선택 (오늘/이번주/이번달) 동작
- [ ] 상세 모달 열기 → 품목별 금액 확인
- [ ] 반응형: 모바일/테블릿 화면에서 정상 표시

#### B. 판매 금액 정확성
- [ ] 판매액이 0원이 아닌 정상 금액 표시
- [ ] 부가세 포함 checkbox 표시 (O/X)
- [ ] 이익 계산 정확성

#### C. 입고 부가세 로직
- [ ] **부가세 포함** 체크 → 단가 11,000 입력
  - [ ] 공급가: 10,000
  - [ ] 부가세: 1,000
  - [ ] 합계: 11,000
  - [ ] 재고 저장: 11,000

- [ ] **부가세 미포함** 체크 → 단가 10,000 입력
  - [ ] 공급가: 10,000
  - [ ] 부가세: 1,000
  - [ ] 합계: 11,000
  - [ ] 재고 저장: 11,000 (✅ 자동 변환)

#### D. 시스템 통합 테스트
- [ ] 입고 → 재고 증가 → 판매 → 재고 감소 (FIFO)
- [ ] 판매 원가 정확성 (FIFO 적용)
- [ ] 재고 조정 (INCREASE/DECREASE)
- [ ] 조정 취소 (당일만 가능)

---

## 📂 핵심 파일 위치

### 데이터베이스
```
database/
├── purchases_sales_rpc_functions.sql    ← get_sales_list 수정
├── phase5_inventory_adjustments_schema.sql
├── phase5_fix_inventory_layers.sql
└── complete_schema.sql                 ← 전체 스키마 통합
```

### 프론트엔드 (판매)
```
app/sales/
├── page.tsx                            ← 서버 컴포넌트
└── actions.ts                          ← getSalesHistory() 수정

components/sales/
├── salehistorytable.tsx               ← 거래번호 그룹화 (신규)
├── SaleDetailModal.tsx                ← 상세 모달 (신규)
├── salegrid.tsx                       ← try-catch 추가
└── ...

types/
└── sales.ts                           ← SaleGroup 인터페이스
```

### 프론트엔드 (입고)
```
components/purchases/
├── PurchaseGrid.tsx                   ← calculatePrices() 개선 (2025-12-04)
├── PurchaseForm.tsx
└── ...
```

---

## 🔍 주요 버그 수정 이력

### 1. 판매 금액 0원 표시 (Phase 6-1)
**원인**: RPC 함수에서 `total_price`를 반환했는데 앱이 `total_amount` 필드 기대  
**해결**: RPC 함수에 `s.total_price AS total_amount` 별칭 추가  
**파일**: `database/purchases_sales_rpc_functions.sql`

### 2. RPC 함수 타입 불일치 (Phase 6-2)
**원인**: VARCHAR 필드를 TEXT로, INTEGER를 NUMERIC으로 캐스팅하지 않음  
**해결**: 모든 필드에 명시적 타입 캐스팅 추가  
**파일**: `database/purchases_sales_rpc_functions.sql`

### 3. AG Grid 파괴 에러 (Phase 6-3)
**원인**: Grid 언마운트 중 비동기 `refreshCells()` 호출  
**해결**: try-catch로 에러 무시  
**파일**: `components/sales/salegrid.tsx`

### 4. 부가세 미포함 단가 미변환 (Phase 6-4)
**원인**: 부가세 미포함 시 입력 단가를 그대로 저장 (부가세 포함 아님)  
**해결**: `row.unit_cost = Math.round(inputUnitCost * 1.1)` 추가  
**파일**: `components/purchases/PurchaseGrid.tsx`

---

## 🎯 다음 Phase 계획 (Phase 7+)

### Phase 7: 보고서 및 분석 (예상)
- [ ] 판매 보고서 (일자별/거래처별)
- [ ] 입고 보고서 (공급업체별)
- [ ] 재고 현황 보고서 (품목별/지점별)
- [ ] 원가 분석 (FIFO 원가 vs 판매가)
- [ ] 손익 계산서

### Phase 8: 추가 기능 (예상)
- [ ] 선주문 관리
- [ ] 예산 관리
- [ ] 가격표 관리
- [ ] 배송 추적

---

## 💾 배포 및 유지보수

### 데이터베이스 업데이트 절차
1. `database/` 폴더의 SQL 스크립트 확인
2. Supabase SQL Editor에서 실행
3. 타입 재생성: `supabase gen types typescript --local > types/supabase.ts`
4. Next.js 재시작

### 코드 배포
1. 모든 파일 변경사항 확인
2. `npm run build` → 빌드 에러 확인
3. `npm run lint` → 스타일 체크
4. Git commit & push
5. 프로덕션 배포

### 주의사항
- **RPC 함수 수정 시**: 파라미터 타입 (TEXT 필수), 반환 타입 (TEXT 필수) 확인
- **필드 매핑**: DB 필드명 ≠ RPC 반환명인 경우 Server Actions에서 변환 필수
- **Type 캐스팅**: `::TEXT`, `::NUMERIC`, `::UUID` 명시적 사용
- **에러 처리**: Grid 관련 에러는 try-catch로 무시 (정상 동작)

---

## 📚 참고 자료

| 문서 | 용도 |
|------|------|
| `.github/copilot-instructions.md` | 프로젝트 아키텍처 가이드 |
| `DATABASE_HANDOVER.md` | Phase 0-4 DB 설계 문서 |
| `PHASE5_HANDOVER.md` | Phase 5 재고 조정 상세 |
| `database/README.md` | DB 스키마 및 RPC 함수 설명 |
| `docs/DEVELOPMENT_LESSONS.md` | Phase 3.5 교훈 (트리거 제거) |
| `docs/NEXT_TASKS.md` | 향후 작업 우선순위 |

---

## 📞 다음 세션 시작 방법

### 1. 현재 상태 확인
```bash
# 1. 프로젝트 시작
npm run dev

# 2. 판매 목록 확인 (http://localhost:3000/sales)
# 3. 입고 목록 확인 (http://localhost:3000/purchases)
# 4. 콘솔 에러 확인
```

### 2. 테스트 진행
- 위 "테스트 체크리스트" 참고
- 발견된 버그 기록

### 3. 다음 작업 결정
- 추가 기능 개선 (예: 보고서)
- 버그 수정
- Phase 7 시작

---

**마지막 커밋**: Phase 6 완료 (2025-12-04)  
**다음 검토**: Phase 6 테스트 완료 후 Phase 7 논의

