# Phase 5: 재고 조정 기능 구현 계획

## 📋 개요

**목표**: 입고/판매 외의 재고 변동을 처리하는 재고 조정 시스템 구현  
**예상 시간**: 4시간  
**우선순위**: 높음 (실사, 불량, 분실 등 필수 기능)  
**권한**: 매니저 이상 (0000~0002), 취소는 원장 이상 (0000~0001)

### 🔧 Phase 3.5 교훈 반영
- ❌ **트리거 방식 제거**: Audit Log 트리거 중복 문제 방지
- ✅ **RPC 직접 기록**: process_inventory_adjustment()에서 audit_logs INSERT
- ✅ **권한 확대**: 매니저(0002)도 재고 조정 가능 (실무 요구사항)

---

## 🎯 Phase 5 세부 단계

### Phase 5-1: 데이터베이스 스키마 (40분)

#### 5-1-1. inventory_adjustments 테이블 생성 (20분)
```sql
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- 조정 정보
  adjustment_type TEXT NOT NULL, -- 'INCREASE', 'DECREASE'
  adjustment_reason TEXT NOT NULL, -- 'STOCK_COUNT', 'DAMAGE', 'LOSS', 'RETURN', 'OTHER'
  
  -- 수량 정보
  quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  
  -- 원가 정보 (증가 시 필요)
  unit_cost NUMERIC(15, 2), -- 증가 시 원가
  total_cost NUMERIC(15, 2), -- quantity * unit_cost
  
  -- 메타 정보
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  reference_number TEXT, -- 외부 참조 번호
  
  -- 감사 정보
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 인덱스
  CONSTRAINT valid_adjustment_type CHECK (adjustment_type IN ('INCREASE', 'DECREASE')),
  CONSTRAINT valid_adjustment_reason CHECK (adjustment_reason IN ('STOCK_COUNT', 'DAMAGE', 'LOSS', 'RETURN', 'OTHER'))
);

-- 인덱스
CREATE INDEX idx_inventory_adjustments_branch ON inventory_adjustments(branch_id);
CREATE INDEX idx_inventory_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX idx_inventory_adjustments_date ON inventory_adjustments(adjustment_date);
CREATE INDEX idx_inventory_adjustments_type ON inventory_adjustments(adjustment_type);
```

**조정 사유 정의**:
- `STOCK_COUNT`: 재고 실사 (실제 재고와 시스템 재고 차이 조정)
- `DAMAGE`: 불량/파손 (재고 감소)
- `LOSS`: 분실/도난 (재고 감소)
- `RETURN`: 반품 입고 (재고 증가)
- `OTHER`: 기타 사유

#### 5-1-2. Audit Log 처리 방식 (트리거 없음)
**Phase 3.5 교훈 반영**: 트리거 대신 RPC 함수에서 직접 audit_logs INSERT

```sql
-- ❌ 트리거 방식 사용 안 함 (트리거 중복 문제 방지)
-- CREATE TRIGGER audit_inventory_adjustments_trigger ...

-- ✅ RPC 함수에서 직접 기록
-- process_inventory_adjustment() 함수 내부에서
INSERT INTO audit_logs (
  table_name,
  record_id,
  action,
  user_id,
  username,
  user_role,
  branch_id,
  branch_name,
  old_data,
  new_data,
  changed_fields
) VALUES (...);
```

**장점**:
- 트리거 중복 문제 없음
- 명시적 제어 가능
- Phase 3.5 패턴과 일관성

---

### Phase 5-2: RPC 함수 구현 (60분)

#### 5-2-1. process_inventory_adjustment() - 재고 조정 처리 (30분)
```sql
CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_branch_id UUID,
  p_product_id UUID,
  p_adjustment_type TEXT,
  p_adjustment_reason TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_notes TEXT,
  p_reference_number TEXT,
  p_user_id UUID,
  p_user_role TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  adjustment_id UUID
)
```

**로직**:
1. 권한 검증 (**매니저 이상** 조정 가능: 0000, 0001, 0002)
2. 지점 격리 (시스템 관리자 제외)
3. **INCREASE**: inventory_layers에 신규 레이어 추가
4. **DECREASE**: FIFO 방식으로 레이어 차감
5. inventory_adjustments 테이블에 기록
6. **Audit Log 직접 기록** (INSERT INTO audit_logs)

#### 5-2-2. get_inventory_adjustments() - 조정 내역 조회 (20분)
```sql
CREATE OR REPLACE FUNCTION get_inventory_adjustments(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_adjustment_type TEXT DEFAULT NULL,
  p_adjustment_reason TEXT DEFAULT NULL
)
RETURNS TABLE (...)
```

**필터**:
- 날짜 범위
- 조정 유형 (INCREASE/DECREASE)
- 조정 사유
- 지점 격리 (원장은 본인 지점만)

#### 5-2-3. get_adjustment_summary() - 조정 통계 (10분)
```sql
CREATE OR REPLACE FUNCTION get_adjustment_summary(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_adjustments INT,
  increase_count INT,
  decrease_count INT,
  total_increase_value NUMERIC,
  total_decrease_value NUMERIC,
  by_reason JSONB
)
```

---

### Phase 5-3: Server Actions (40분)

#### 5-3-1. app/inventory-adjustments/actions.ts (40분)
```typescript
'use server'

// 재고 조정 저장
export async function saveInventoryAdjustment(data: AdjustmentRequest): Promise<ActionResult>

// 조정 내역 조회
export async function getAdjustmentHistory(filters: AdjustmentFilters): Promise<ActionResult>

// 조정 통계
export async function getAdjustmentSummary(startDate: string, endDate: string): Promise<ActionResult>

// 조정 취소 (원장 이상, 당일만 가능)
export async function cancelAdjustment(adjustmentId: string): Promise<ActionResult>
```

**권한 체크**:
- 조정 생성: **매니저 이상** (0000~0002)
- 조정 조회: **매니저 이상** (0000~0002)
- 조정 취소: **원장 이상** (0000~0001, 당일 데이터만)

---

### Phase 5-4: TypeScript 타입 정의 (20분)

#### 5-4-1. types/inventory-adjustment.ts
```typescript
export type AdjustmentType = 'INCREASE' | 'DECREASE'

export type AdjustmentReason = 
  | 'STOCK_COUNT'   // 재고 실사
  | 'DAMAGE'        // 불량/파손
  | 'LOSS'          // 분실/도난
  | 'RETURN'        // 반품 입고
  | 'OTHER'         // 기타

export interface InventoryAdjustment {
  id: string
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  
  adjustment_type: AdjustmentType
  adjustment_reason: AdjustmentReason
  quantity: number
  unit_cost: number | null
  total_cost: number | null
  
  adjustment_date: string
  notes: string | null
  reference_number: string | null
  
  created_by: string
  created_by_username: string
  created_at: string
}

export interface AdjustmentRequest {
  branch_id: string
  product_id: string
  adjustment_type: AdjustmentType
  adjustment_reason: AdjustmentReason
  quantity: number
  unit_cost?: number  // INCREASE 시 필수
  notes?: string
  reference_number?: string
  user_id: string
  user_role: string
}

export interface AdjustmentFilters {
  start_date?: string
  end_date?: string
  adjustment_type?: AdjustmentType
  adjustment_reason?: AdjustmentReason
}
```

---

### Phase 5-5: UI 컴포넌트 (80분)

#### 5-5-1. 재고 조정 페이지 구조
```
app/inventory-adjustments/
  - page.tsx (서버 컴포넌트, 세션 검증)
  - actions.ts (Server Actions)

components/inventory-adjustments/
  - AdjustmentForm.tsx (조정 입력 폼)
  - AdjustmentHistoryTable.tsx (조정 내역 테이블)
  - AdjustmentTypeSelector.tsx (증가/감소 선택)
  - AdjustmentReasonSelector.tsx (사유 선택)
  - AdjustmentStats.tsx (통계 카드)
```

#### 5-5-2. AdjustmentForm.tsx (40분)
**기능**:
- 품목 검색 (자동완성)
- 조정 유형 선택 (증가/감소)
- 조정 사유 선택 (드롭다운)
- 수량 입력
- 원가 입력 (증가 시만 표시)
- 비고 입력
- 현재 재고 표시 (실시간 조회)

**검증**:
- 감소 시 현재 재고보다 많이 차감 불가
- 증가 시 원가 필수 입력
- 수량 > 0 검증

#### 5-5-3. AdjustmentHistoryTable.tsx (30분)
**컬럼**:
- 조정일자
- 품목코드/품목명
- 조정유형 (증가/감소 배지)
- 조정사유
- 수량
- 원가 (증가 시)
- 총액
- 작성자
- 비고

**필터**:
- 날짜 범위
- 조정 유형
- 조정 사유
- 검색 (품목명)

**액션**:
- 취소 버튼 (당일 데이터만, 원장 이상)

#### 5-5-4. AdjustmentStats.tsx (10분)
**통계 카드**:
- 총 조정 건수
- 증가 건수 / 금액
- 감소 건수 / 금액
- 사유별 분포 (차트)

---

### Phase 5-6: 네비게이션 및 권한 통합 (20분)

#### 5-6-1. Navigation.tsx 업데이트
```typescript
// 재고 조정 메뉴 추가 (매니저 이상만 표시)
{can('inventory_adjustments', 'read') && (
  <Link href="/inventory-adjustments">
    📝 재고 조정
  </Link>
)}
```

#### 5-6-2. types/permissions.ts 업데이트
```typescript
export const ROLE_PERMISSIONS = {
  '0000': {
    inventory_adjustments: ['create', 'read', 'update', 'delete'],
  },
  '0001': {
    inventory_adjustments: ['create', 'read', 'delete'],  // 원장: 취소 가능
  },
  '0002': {
    inventory_adjustments: ['create', 'read'],  // 매니저: 생성/조회만
  },
  '0003': {
    inventory_adjustments: [],  // 사용자: 권한 없음
  },
}
```

**권한 구조**:
- **시스템 관리자 (0000)**: 모든 권한 (전체 지점 조정 가능)
- **원장 (0001)**: 생성/조회/취소 (본인 지점만)
- **매니저 (0002)**: 생성/조회만 (본인 지점만, 취소 불가)
- **사용자 (0003)**: 권한 없음

---

### Phase 5-7: 통합 테스트 (40분)

#### 테스트 시나리오
```sql
-- database/phase5_integration_test.sql

-- [TC-1] 재고 증가 (반품 입고)
-- 예상: inventory_layers에 신규 레이어 추가
SELECT * FROM process_inventory_adjustment(
  p_branch_id := 'branch-uuid',
  p_product_id := 'product-uuid',
  p_adjustment_type := 'INCREASE',
  p_adjustment_reason := 'RETURN',
  p_quantity := 10,
  p_unit_cost := 50000,
  ...
);

-- [TC-2] 재고 감소 (불량 처리)
-- 예상: FIFO 방식으로 레이어 차감
SELECT * FROM process_inventory_adjustment(
  p_adjustment_type := 'DECREASE',
  p_adjustment_reason := 'DAMAGE',
  p_quantity := 5,
  ...
);

-- [TC-3] 재고 실사 조정
-- 예상: 시스템 재고 vs 실제 재고 차이만큼 조정

-- [TC-4] 권한 검증
-- 매니저(0002) 시도 → 에러 발생 확인

-- [TC-5] 지점 격리
-- A지점 원장이 B지점 재고 조정 시도 → 에러
```

---

## 📊 작업 순서 및 체크리스트

### Step 1: 데이터베이스 (30분)
- [ ] inventory_adjustments 테이블 생성
- [ ] 인덱스 추가
- [ ] ~~Audit Log 트리거~~ → RPC 함수에서 직접 처리

### Step 2: RPC 함수 (70분)
- [ ] process_inventory_adjustment() 구현 (audit_logs INSERT 포함)
- [ ] get_inventory_adjustments() 구현
- [ ] get_adjustment_summary() 구현
- [ ] cancel_inventory_adjustment() 구현 (원장 이상, 당일만)
- [ ] 함수 테스트 (SQL)

### Step 3: 백엔드 (40분)
- [ ] types/inventory-adjustment.ts 생성
- [ ] app/inventory-adjustments/actions.ts 생성
- [ ] Server Actions 4개 구현
- [ ] 권한 체크 추가

### Step 4: UI - 폼 (40분)
- [ ] app/inventory-adjustments/page.tsx 생성
- [ ] AdjustmentForm.tsx 생성
- [ ] 품목 검색 자동완성
- [ ] 유형/사유 선택기
- [ ] 폼 검증 로직

### Step 5: UI - 테이블 (30분)
- [ ] AdjustmentHistoryTable.tsx 생성
- [ ] 필터링 기능
- [ ] 페이지네이션
- [ ] 취소 버튼 (조건부)

### Step 6: UI - 통계 (10분)
- [ ] AdjustmentStats.tsx 생성
- [ ] 통계 카드 표시

### Step 7: 통합 (20분)
- [ ] Navigation.tsx 메뉴 추가
- [ ] types/permissions.ts 업데이트
- [ ] ProtectedAction 적용

### Step 8: 테스트 (40분)
- [ ] 재고 증가 테스트
- [ ] 재고 감소 테스트
- [ ] FIFO 차감 확인
- [ ] 권한 테스트
- [ ] 지점 격리 테스트
- [ ] Audit Log 기록 확인
- [ ] UI 반응형 테스트

---

## 🎯 핵심 비즈니스 로직

### 재고 증가 (INCREASE)
```typescript
// 1. inventory_layers에 신규 레이어 추가
INSERT INTO inventory_layers (
  branch_id, product_id, 
  source_type, source_id,
  quantity, remaining_quantity,
  unit_cost, created_at
) VALUES (
  p_branch_id, p_product_id,
  'ADJUSTMENT', adjustment_id,
  p_quantity, p_quantity,
  p_unit_cost, NOW()
);

// 2. inventory_adjustments 기록
INSERT INTO inventory_adjustments (...) VALUES (...);
```

### 재고 감소 (DECREASE)
```typescript
// 1. FIFO 방식으로 기존 레이어 차감 (process_sale_with_fifo 로직 재사용)
// 2. inventory_adjustments 기록
// 3. 원가는 차감된 레이어의 평균 원가로 자동 계산
```

---

## 🚨 주의사항

1. **권한 제한**: **매니저 이상** 조정 가능 (0000~0002)
2. **취소 권한**: 원장 이상만 취소 가능 (0000~0001, 당일 데이터만)
3. **감소 시 재고 부족 검증**: remaining_quantity 합계 확인
4. **증가 시 원가 필수**: 레이어 생성을 위해 unit_cost 필요
5. **Audit Log 직접 기록**: RPC 함수에서 INSERT (트리거 사용 안 함)
6. **FIFO 일관성**: 감소 시 가장 오래된 레이어부터 차감
7. **Phase 3.5 교훈**: 트리거 중복 문제 방지를 위해 직접 INSERT 방식 채택

---

## 📈 완료 후 기대 효과

1. ✅ **재고 정확도 향상**: 실사 결과를 시스템에 반영
2. ✅ **손실 관리**: 불량/분실 재고 추적
3. ✅ **반품 처리**: 반품 입고를 별도 처리
4. ✅ **감사 추적**: 모든 조정 내역 기록
5. ✅ **통계 분석**: 조정 사유별 통계 확인

---

## 🔗 연관 파일

### 생성할 파일
- `database/phase5_inventory_adjustments_schema.sql`
- `database/phase5_inventory_adjustments_rpc.sql`
- `database/phase5_integration_test.sql`
- `types/inventory-adjustment.ts`
- `app/inventory-adjustments/page.tsx`
- `app/inventory-adjustments/actions.ts`
- `components/inventory-adjustments/AdjustmentForm.tsx`
- `components/inventory-adjustments/AdjustmentHistoryTable.tsx`
- `components/inventory-adjustments/AdjustmentStats.tsx`

### 수정할 파일
- `components/shared/Navigation.tsx`
- `types/permissions.ts`
- `lib/permissions.ts`

---

## 🎬 시작 준비 완료!

모든 계획이 수립되었습니다. **Step 1 (데이터베이스)부터 시작**할까요? 👍
