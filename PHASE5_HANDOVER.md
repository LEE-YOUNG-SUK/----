# Phase 5: 재고 조정 시스템 인수인계서

## 📋 작업 완료 현황

### ✅ 완료된 작업 (Step 1-7)
- **Step 1**: 데이터베이스 스키마 생성
- **Step 2**: RPC 함수 4개 구현 (process, get, summary, cancel)
- **Step 3**: TypeScript 타입 및 Server Actions
- **Step 4**: 조정 입력 폼 UI
- **Step 5**: 조정 내역 테이블 UI
- **Step 6**: 통계 컴포넌트
- **Step 7**: 네비게이션 및 권한 통합

### ⏳ 남은 작업
- **Step 8**: 통합 테스트 (재고 감소 FIFO, 권한 체크, 지점 격리)

---

## 🗂️ 핵심 파일 구조

### 📊 데이터베이스 (Supabase)
```
database/
├── phase5_inventory_adjustments_schema.sql      # 테이블 생성 (실행 완료)
├── phase5_inventory_adjustments_rpc.sql         # 원본 RPC (참고용)
├── phase5_fix_inventory_layers.sql              # process 함수 수정 (실행 완료)
├── phase5_fix_rpc_parameters.sql                # get/summary RPC 수정 (실행 완료)
└── phase5_fix_cancel_function.sql               # cancel 함수 수정 (실행 완료)
```

**주요 테이블**:
- `inventory_adjustments`: 조정 내역 (18 컬럼)
- `inventory_layers`: 확장 (`source_type`, `source_id` 추가)

**RPC 함수 (모두 TEXT 파라미터)**:
1. `process_inventory_adjustment()` - 조정 처리 (FIFO)
2. `get_inventory_adjustments()` - 내역 조회
3. `get_adjustment_summary()` - 통계
4. `cancel_inventory_adjustment()` - 취소 (원장 이상)

### 🎨 프론트엔드
```
app/inventory-adjustments/
├── page.tsx                          # 서버 컴포넌트 (세션, 데이터 fetch)
└── actions.ts                        # Server Actions (6개 함수)

components/inventory-adjustments/
├── AdjustmentForm.tsx                # 입력 폼 (품목 검색, 자동 계산)
├── AdjustmentHistoryTable.tsx       # 내역 테이블 (필터, 페이지네이션)
└── AdjustmentStats.tsx               # 통계 카드

types/
└── inventory-adjustment.ts           # 타입 정의 (AdjustmentType, Reason 등)
```

---

## 🔧 주요 디버깅 이슈 및 해결

### 1️⃣ UUID vs TEXT 타입 불일치
**문제**: RPC 함수 파라미터가 UUID였으나, Supabase 클라이언트가 TEXT 전달
**해결**: 모든 RPC 함수를 TEXT 파라미터로 변경, 내부에서 UUID 캐스팅
```sql
-- 수정 전
CREATE FUNCTION get_inventory_adjustments(p_user_id UUID, ...)

-- 수정 후
CREATE FUNCTION get_inventory_adjustments(p_user_id TEXT, ...)
RETURNS TABLE (id TEXT, branch_id TEXT, ...)  -- 반환도 TEXT
SELECT ia.id::TEXT, ia.branch_id::TEXT, ...    -- 명시적 캐스팅
```

### 2️⃣ inventory_layers 컬럼 오류
**문제**: `reference_number` 컬럼이 존재하지 않음
**해결**: INSERT 문에서 `reference_number` 제거
```sql
-- 수정 전
INSERT INTO inventory_layers (..., reference_number, ...)
VALUES (..., p_reference_number, ...)

-- 수정 후
INSERT INTO inventory_layers (..., source_type, source_id)
VALUES (..., 'ADJUSTMENT', v_adjustment_id)
```

### 3️⃣ audit_logs 타입 오류
**문제**: `record_id`가 UUID 타입인데 TEXT 전달
**해결**: `::UUID` 캐스팅 추가
```sql
INSERT INTO audit_logs (record_id, user_id, branch_id, ...)
VALUES (
  p_adjustment_id::UUID,    -- TEXT → UUID
  p_user_id::UUID,          -- TEXT → UUID
  v_adjustment_branch_id,   -- 이미 UUID
  ...
)
```

### 4️⃣ React Server Component 이벤트 핸들러 에러
**문제**: Server Component에서 Client Component로 함수 전달 불가
**해결**: Client Component 내부에서 `useRouter().refresh()` 사용
```tsx
// 수정 전 (page.tsx)
<AdjustmentForm onSuccess={() => window.location.reload()} />

// 수정 후 (page.tsx)
<AdjustmentForm products={products} session={session} />

// AdjustmentForm.tsx
const router = useRouter()
// ... 성공 후
router.refresh()  // Server Component 재렌더링
```

### 5️⃣ Session 객체 read-only 에러
**문제**: `userSession` 객체를 직접 전달 시 read-only 에러
**해결**: 새 객체 생성하여 전달
```tsx
// 수정 전
<AdjustmentForm session={userSession} />

// 수정 후
<AdjustmentForm session={{
  user_id: userSession.user_id,
  branch_id: branchIdForQuery,
  branch_name: userSession.branch_name || '',
  role: userSession.role
}} />
```

---

## 🎯 핵심 비즈니스 로직

### FIFO 재고 차감 (DECREASE)
```sql
FOR v_layer_id, v_layer_remaining, v_calculated_unit_cost IN
  SELECT id, remaining_quantity, unit_cost
  FROM inventory_layers
  WHERE branch_id = p_branch_id AND product_id = p_product_id
    AND remaining_quantity > 0
  ORDER BY purchase_date ASC, created_at ASC  -- FIFO 순서
LOOP
  IF v_layer_remaining >= v_to_deduct THEN
    -- 이 레이어에서 전부 차감
    UPDATE inventory_layers SET remaining_quantity = remaining_quantity - v_to_deduct
    WHERE id = v_layer_id;
    v_to_deduct := 0;
  ELSE
    -- 이 레이어를 전부 사용하고 다음 레이어로
    UPDATE inventory_layers SET remaining_quantity = 0 WHERE id = v_layer_id;
    v_to_deduct := v_to_deduct - v_layer_remaining;
  END IF;
END LOOP;

-- 가중평균 원가 계산
UPDATE inventory_adjustments
SET unit_cost = v_total_cost_sum / v_quantity_sum
WHERE id = v_adjustment_id;
```

### 권한 시스템
- **조정 생성**: 매니저 이상 (0000~0002)
- **조정 취소**: 원장 이상 (0000~0001), 당일만 가능
- **지점 격리**: 시스템 관리자(0000) 제외, 본인 지점만 접근

### Audit Log 직접 기록
- 트리거 사용 안 함 (Phase 3.5 교훈)
- RPC 함수 내부에서 `INSERT INTO audit_logs` 직접 실행
- `changed_fields` 배열로 변경된 필드 추적

---

## 🧪 테스트 가이드

### 필수 테스트 항목
1. **재고 증가 (INCREASE)**:
   - 품목 선택 → 수량/원가 입력 → 부가세 자동 계산 확인
   - `inventory_layers`에 새 레이어 생성 확인 (`source_type='ADJUSTMENT'`)
   - `audit_logs`에 INSERT 액션 기록 확인

2. **재고 감소 (DECREASE)**:
   - 재고 있는 품목 선택 → 수량 입력
   - FIFO 순서로 차감되는지 `inventory_layers` 확인
   - 가중평균 원가 자동 계산 확인

3. **취소 기능**:
   - INCREASE 취소 → `inventory_layers` 레이어 삭제 확인
   - DECREASE 취소 → `remaining_quantity` 복원 확인
   - 당일 외 데이터 취소 시도 → 에러 메시지

4. **검증 로직**:
   - 재고보다 많은 수량 감소 → "재고 부족" 에러
   - INCREASE 시 원가 미입력 → "단위 원가는 필수" 에러
   - 사용자(0003) 접근 → "매니저 이상 필요" 메시지

5. **통계 확인**:
   - 상단 4개 카드 (총 조정, 증가, 감소, 순 변동)
   - 사유별 집계 (실사, 불량, 분실, 반품, 기타)

### SQL 검증 쿼리
```sql
-- 조정 내역 확인
SELECT * FROM inventory_adjustments ORDER BY created_at DESC LIMIT 10;

-- 재고 레이어 확인 (조정으로 생성된 것)
SELECT * FROM inventory_layers 
WHERE source_type = 'ADJUSTMENT' 
ORDER BY created_at DESC LIMIT 10;

-- Audit Log 확인
SELECT * FROM audit_logs 
WHERE table_name = 'inventory_adjustments' 
ORDER BY created_at DESC LIMIT 10;
```

---

## 📝 다음 세션 시작 방법

1. **현재 상태 확인**:
   ```
   - 재고 조정 메뉴 접근 가능
   - INCREASE/DECREASE 모두 작동
   - 취소 기능 정상 작동
   ```

2. **남은 작업**:
   - Step 8 통합 테스트 (위 테스트 가이드 참고)
   - 발견된 버그 수정
   - Phase 6로 진행 (다음 기능)

3. **중요 파일 위치**:
   - 메인 페이지: `app/inventory-adjustments/page.tsx`
   - Server Actions: `app/inventory-adjustments/actions.ts`
   - DB 스키마: `database/phase5_*.sql`

4. **주의사항**:
   - RPC 함수 수정 시 Supabase SQL Editor에서 실행 필수
   - `audit_logs` INSERT 시 UUID 캐스팅 필수 (`::UUID`)
   - Server Component에서 함수 전달 금지 (useRouter 사용)

---

## 🔍 참고 문서
- `DATABASE_HANDOVER.md`: 전체 DB 구조 및 Phase 0-3 히스토리
- `.github/copilot-instructions.md`: 프로젝트 아키텍처 가이드
- `docs/DEVELOPMENT_LESSONS.md`: Phase 3.5 교훈 (트리거 제거 이유)

---

**작성일**: 2025-11-27  
**상태**: Phase 5 Step 1-7 완료, Step 8 대기  
**다음 작업**: 통합 테스트 후 다음 Phase 진행
