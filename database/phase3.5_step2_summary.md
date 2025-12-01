# Phase 3.5 Step 2: Server Actions 생성 완료 ✅

## 📋 작업 개요
입고/판매 수정 및 삭제를 위한 Server Actions 추가 완료

## 🎯 생성된 Server Actions

### 1. 입고 관리 (`app/purchases/actions.ts`)

#### ✏️ `updatePurchase(data: PurchaseUpdateRequest)`
- **목적**: 입고 데이터 수정
- **권한**: 모든 역할 (0000~0003) + 지점 격리
- **기능**:
  - 세션 검증 (`erp_session_token`)
  - 입력 데이터 검증 (ID, 수량, 단가)
  - 사용자 컨텍스트 설정 (`set_config`)
  - RPC 호출: `update_purchase()`
  - 경로 재검증: `/purchases`, `/inventory`
- **Audit Log**: UPDATE 트리거 자동 발동

#### 🗑️ `deletePurchase(data: PurchaseDeleteRequest)`
- **목적**: 입고 데이터 삭제
- **권한**: 원장 이상 (0000~0002) + 지점 격리
- **기능**:
  - 세션 검증
  - ID 검증
  - 사용자 컨텍스트 설정
  - RPC 호출: `delete_purchase()`
  - 경로 재검증: `/purchases`, `/inventory`
- **Audit Log**: DELETE 트리거 자동 발동

### 2. 판매 관리 (`app/sales/actions.ts`)

#### ✏️ `updateSale(data: SaleUpdateRequest)`
- **목적**: 판매 데이터 수정
- **권한**: 모든 역할 (0000~0003) + 지점 격리
- **기능**:
  - 세션 검증
  - 입력 데이터 검증 (ID, 수량, 단가)
  - 사용자 컨텍스트 설정
  - RPC 호출: `update_sale()`
  - 경로 재검증: `/sales`, `/inventory`
- **Audit Log**: UPDATE 트리거 자동 발동

#### 🗑️ `deleteSale(data: SaleDeleteRequest)`
- **목적**: 판매 데이터 삭제
- **권한**: 원장 이상 (0000~0002) + 지점 격리
- **기능**:
  - 세션 검증
  - ID 검증
  - 사용자 컨텍스트 설정
  - RPC 호출: `delete_sale()`
  - 경로 재검증: `/sales`, `/inventory`
- **Audit Log**: DELETE 트리거 자동 발동

## 📦 타입 정의 추가

### `types/purchases.ts`
```typescript
export interface PurchaseUpdateRequest {
  purchase_id: string
  user_id: string
  user_role: string
  user_branch_id: string
  quantity: number
  unit_cost: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
}

export interface PurchaseDeleteRequest {
  purchase_id: string
  user_id: string
  user_role: string
  user_branch_id: string
}
```

### `types/sales.ts`
```typescript
export interface SaleUpdateRequest {
  sale_id: string
  user_id: string
  user_role: string
  user_branch_id: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
}

export interface SaleDeleteRequest {
  sale_id: string
  user_id: string
  user_role: string
  user_branch_id: string
}
```

## 🔐 보안 & 권한

### 공통 보안 체크
1. ✅ 세션 토큰 검증 (`erp_session_token`)
2. ✅ 사용자 컨텍스트 설정 (`app.current_user_id`)
3. ✅ RPC 레벨 권한 검증 (함수 내부)
4. ✅ RPC 레벨 지점 격리 (함수 내부)

### 권한 정책
- **수정 (UPDATE)**: 모든 역할 + 본인 지점만 (시스템 관리자 제외)
- **삭제 (DELETE)**: 원장 이상 + 본인 지점만 (시스템 관리자 제외)

### Audit Log 자동 기록
- UPDATE 트리거: `audit_purchase_changes()` → `audit_logs` 테이블 기록
- DELETE 트리거: `audit_purchase_changes()` → `audit_logs` 테이블 기록
- 사용자 정보: `app.current_user_id` 컨텍스트에서 자동 추출

## 🧪 검증 결과

### TypeScript 타입 체크
```bash
npm run build
✅ Server Actions 타입 오류 없음
✅ Import 경로 정상
✅ 함수 시그니처 정상
```

### 코드 패턴 일관성
- ✅ 기존 `savePurchases()`, `saveSales()` 패턴 100% 준수
- ✅ 에러 처리 동일 (try-catch, console.error)
- ✅ revalidatePath 호출 일치
- ✅ RPC 호출 방식 통일

## 📊 코드 통계
- **수정된 파일**: 4개
  - `types/purchases.ts` (+23 lines)
  - `types/sales.ts` (+23 lines)
  - `app/purchases/actions.ts` (+198 lines)
  - `app/sales/actions.ts` (+198 lines)
- **추가된 함수**: 4개
- **추가된 타입**: 4개

## 🔄 다음 단계: Step 3 (Purchase UI)

### 작업 내용
1. `components/purchases/PurchaseHistoryTable.tsx` 수정
   - 테이블에 편집/삭제 버튼 컬럼 추가
   - `EditPurchaseModal` 컴포넌트 생성
   - 권한에 따라 삭제 버튼 표시/숨김
   - Server Actions 연동

### 권한 UI 조건
```typescript
// 편집 버튼: 모든 역할 표시
{can('purchases_management', 'update') && <EditButton />}

// 삭제 버튼: 원장 이상만 표시
{role <= '0002' && can('purchases_management', 'delete') && <DeleteButton />}
```

---

**생성 일시**: 2025-01-26  
**Phase**: 3.5 - UPDATE/DELETE 기능 추가  
**상태**: Step 2 완료 ✅
