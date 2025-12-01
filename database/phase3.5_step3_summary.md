# Phase 3.5 Step 3: Purchase UI 생성 완료 ✅

## 📋 작업 개요
입고 내역 테이블에 수정/삭제 UI 기능 추가 완료

## 🎯 생성/수정된 컴포넌트

### 1. 새로 생성된 컴포넌트

#### 📝 `EditPurchaseModal.tsx` (신규)
**위치**: `components/purchases/EditPurchaseModal.tsx`

**기능**:
- 입고 데이터 수정을 위한 모달 다이얼로그
- 읽기 전용 필드: 품목코드, 품목명, 공급업체, 입고일, 참조번호
- 수정 가능 필드: 수량, 단가, 비고
- 자동 계산: 공급가, 부가세(10%), 합계
- 입력 검증: 수량 > 0, 단가 > 0
- 반응형 레이아웃 (모바일/데스크톱)

**Props**:
```typescript
interface EditPurchaseModalProps {
  purchase: PurchaseHistory        // 수정할 입고 데이터
  onClose: () => void              // 모달 닫기 콜백
  onSave: (data: {...}) => Promise<void>  // 저장 콜백
}
```

**자동 계산 로직**:
```typescript
공급가 = 수량 × 단가
부가세 = Math.round(공급가 × 0.1)  // 정수
합계 = 공급가 + 부가세
```

### 2. 수정된 컴포넌트

#### 📊 `PurchaseHistoryTable.tsx` (업데이트)
**위치**: `components/purchases/PurchaseHistoryTable.tsx`

**추가된 기능**:

1. **Props 확장**:
```typescript
interface PurchaseHistoryTableProps {
  data: PurchaseHistory[]
  branchName: string | null
  userRole: string           // ✨ 신규
  userId: string             // ✨ 신규
  userBranchId: string       // ✨ 신규
}
```

2. **권한 체크**:
```typescript
const { can } = usePermissions(userRole)
const canEdit = can('purchases_management', 'update')  // 모든 역할
const canDelete = userRole <= '0002' && can('purchases_management', 'delete')  // 원장 이상
```

3. **상태 관리**:
```typescript
const [editingPurchase, setEditingPurchase] = useState<PurchaseHistory | null>(null)
const [isDeleting, setIsDeleting] = useState<string | null>(null)
```

4. **핸들러 함수**:
- `handleEdit()`: Server Action `updatePurchase()` 호출 → 성공 시 새로고침
- `handleDelete()`: 확인 다이얼로그 → Server Action `deletePurchase()` 호출 → 성공 시 새로고침

5. **UI 변경**:
- **데스크톱 테이블**: 
  - 새로운 "액션" 컬럼 추가
  - 편집/삭제 버튼 표시
  - 삭제 중 상태 표시 ("...")
- **모바일 카드뷰**:
  - 카드 하단에 편집/삭제 버튼 추가
  - 버튼 영역 구분선 추가

#### 🔧 `PurchaseForm.tsx` (업데이트)
**위치**: `components/purchases/PurchaseForm.tsx`

**변경 사항**:
```typescript
<PurchaseHistoryTable
  data={history}
  branchName={session.branch_name || '전체 지점'}
  userRole={session.role}      // ✨ 추가
  userId={session.user_id}      // ✨ 추가
  userBranchId={session.branch_id}  // ✨ 추가
/>
```

## 🔐 권한 시스템

### 편집 권한
- **대상**: 모든 역할 (0000~0003)
- **조건**: `purchases_management.update` 권한
- **지점 격리**: Server Action 레벨에서 검증

### 삭제 권한
- **대상**: 원장 이상 (0000~0002)
- **조건**: `userRole <= '0002'` AND `purchases_management.delete` 권한
- **지점 격리**: Server Action 레벨에서 검증

### UI 조건부 렌더링
```typescript
{(canEdit || canDelete) && (
  <div className="action-buttons">
    {canEdit && <Button onClick={edit}>편집</Button>}
    {canDelete && <Button onClick={delete}>삭제</Button>}
  </div>
)}
```

## 🎨 UI/UX 특징

### 모달 디자인
- ✅ 반응형 레이아웃 (max-w-2xl)
- ✅ 최대 높이 제한 (max-h-[90vh])
- ✅ 스크롤 가능한 내용 영역
- ✅ Sticky 헤더/푸터
- ✅ 배경 오버레이 (bg-black/50)

### 버튼 스타일
- **편집**: `variant="outline"` (회색 테두리)
- **삭제**: `variant="destructive"` (빨간색)
- **저장**: `variant="primary"` (파란색)
- **취소**: `variant="outline"` (회색)

### 로딩 상태
- 편집 버튼: 클릭 시 모달 오픈
- 삭제 버튼: "삭제 중..." 텍스트 표시
- 저장 버튼: "저장 중..." 텍스트 표시

## 🔄 데이터 흐름

### 편집 플로우
```
1. 사용자가 "편집" 버튼 클릭
2. setEditingPurchase(item) → 모달 오픈
3. 모달에서 수량/단가 변경 → 자동 계산
4. "저장" 클릭 → handleEdit() 호출
5. Server Action updatePurchase() 실행
6. 성공 시: alert → window.location.reload()
7. 실패 시: alert (에러 메시지)
```

### 삭제 플로우
```
1. 사용자가 "삭제" 버튼 클릭
2. confirm() 다이얼로그 표시 (품목명, 수량 포함)
3. 확인 시: setIsDeleting(purchase.id)
4. Server Action deletePurchase() 실행
5. setIsDeleting(null)
6. 성공 시: alert → window.location.reload()
7. 실패 시: alert (에러 메시지)
```

## 🧪 검증 결과

### TypeScript 타입 체크
```bash
✅ EditPurchaseModal.tsx - No errors
✅ PurchaseHistoryTable.tsx - No errors
✅ PurchaseForm.tsx - No errors
```

### 컴포넌트 구조
- ✅ 모달: 독립적인 재사용 가능한 컴포넌트
- ✅ 테이블: 권한 기반 조건부 렌더링
- ✅ Props: 명확한 타입 정의
- ✅ 핸들러: async/await 패턴 준수

### 반응형 디자인
- ✅ 모바일: 카드뷰 + 버튼 하단 배치
- ✅ 데스크톱: 테이블 + 액션 컬럼
- ✅ 모달: 뷰포트 크기 적응 (max-w-2xl, max-h-90vh)

## 📊 코드 통계
- **수정된 파일**: 3개
  - `components/purchases/PurchaseHistoryTable.tsx` (+100 lines)
  - `components/purchases/PurchaseForm.tsx` (+3 lines)
  - `components/purchases/EditPurchaseModal.tsx` (+241 lines, 신규)
- **추가된 함수**: 2개 (handleEdit, handleDelete)
- **추가된 컴포넌트**: 1개 (EditPurchaseModal)

## 🔄 다음 단계: Step 4 (Sales UI)

### 작업 내용
1. `components/sales/EditSaleModal.tsx` 생성
   - EditPurchaseModal과 동일한 구조
   - 필드명: quantity, unit_price (단가), supply_price, tax_amount, total_price
   
2. `components/sales/SalesHistoryTable.tsx` 수정
   - 편집/삭제 버튼 추가
   - 권한 체크 (동일한 로직)
   - Server Actions 연동
   
3. `components/sales/SalesForm.tsx` 수정
   - Props 전달 (userRole, userId, userBranchId)

### 예상 소요 시간
- 1시간 (Purchase UI와 구조 동일)

---

**생성 일시**: 2025-01-26  
**Phase**: 3.5 - UPDATE/DELETE 기능 추가  
**상태**: Step 3 완료 ✅
