# Phase 2: 권한 시스템 강화 - 완료 가이드

## ✅ 구현 완료 내용

### 1. 권한 매트릭스 수정
- ✅ `types/permissions.ts` - 사용자(0003) 역할 삭제 권한 제거

### 2. RPC 함수 지점 격리
- ✅ `database/phase2_permission_enforcement.sql` - 조회 함수에 권한 검증 추가
  - `get_purchases_list()` - p_user_id 파라미터 추가
  - `get_sales_list()` - p_user_id 파라미터 추가
  - `get_inventory_by_branch()` - p_user_id 파라미터 추가

### 3. 하위 호환성
- ✅ 오버로딩으로 기존 3-파라미터 함수 호출 지원

---

## 🎯 핵심 개선 사항

### 권한 매트릭스 변경

| 역할 | 입고/판매 조회 | 입고/판매 등록 | 입고/판매 수정 | 입고/판매 삭제 |
|---|---|---|---|---|
| 0000 (시스템 관리자) | ✅ 전체 지점 | ✅ 전체 지점 | ✅ 전체 지점 | ✅ 전체 지점 |
| 0001 (원장) | ✅ 본인 지점 | ✅ 본인 지점 | ✅ 본인 지점 | ✅ 본인 지점 |
| 0002 (매니저) | ✅ 본인 지점 | ✅ 본인 지점 | ✅ 본인 지점 | ✅ 본인 지점 |
| 0003 (사용자) | ✅ 본인 지점 | ✅ 본인 지점 | ✅ 본인 지점 | ❌ **불가** |

**변경 사항:**
- **Before**: 사용자(0003)도 삭제 가능
- **After**: 사용자(0003)는 삭제 불가 (원장/매니저 이상만 가능)

### RPC 함수 지점 격리

**Before (Phase 1)**:
```typescript
// ❌ 모든 사용자가 모든 지점 데이터 조회 가능
const { data } = await supabase.rpc('get_purchases_list', {
  p_branch_id: 'B02',  // 다른 지점 조회 가능
  ...
})
```

**After (Phase 2)**:
```typescript
// ✅ 시스템 관리자 외에는 본인 지점으로 강제 변경
const { data } = await supabase.rpc('get_purchases_list', {
  p_branch_id: 'B02',  // 시도
  p_user_id: currentUserId,  // 권한 검증
  ...
})
// 결과: 사용자 지점이 B01이면 B01 데이터만 반환 (B02 무시)
```

**검증 로직:**
```sql
-- RPC 함수 내부
IF v_user_role != '0000' THEN
  -- 시스템 관리자가 아니면 본인 지점으로 강제
  IF p_branch_id IS NULL OR p_branch_id::UUID != v_user_branch_id THEN
    p_branch_id := v_user_branch_id::TEXT;  -- 강제 변경
  END IF;
END IF;
```

---

## 🚀 배포 절차

### Step 1: Supabase에 RPC 함수 등록

1. Supabase SQL Editor 접속
2. `database/phase2_permission_enforcement.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

**예상 출력:**
```
DROP FUNCTION
CREATE FUNCTION (get_purchases_list with user_id)
DROP FUNCTION
CREATE FUNCTION (get_sales_list with user_id)
DROP FUNCTION
CREATE FUNCTION (get_inventory_by_branch with user_id)
GRANT
GRANT
GRANT
CREATE FUNCTION (get_purchases_list 3-param)
CREATE FUNCTION (get_sales_list 3-param)
GRANT
GRANT
```

### Step 2: 함수 등록 검증

```sql
-- 1. 오버로딩된 함수 확인 (같은 이름, 다른 파라미터 수)
SELECT 
  proname,
  pronargs AS param_count,
  pg_get_function_arguments(oid) AS parameters
FROM pg_proc
WHERE proname IN ('get_purchases_list', 'get_sales_list', 'get_inventory_by_branch')
ORDER BY proname, pronargs;

-- 예상 결과:
-- get_purchases_list | 3 | p_branch_id TEXT, p_start_date DATE, p_end_date DATE
-- get_purchases_list | 4 | p_branch_id TEXT, p_start_date DATE, p_end_date DATE, p_user_id UUID
-- get_sales_list | 3 | ...
-- get_sales_list | 4 | ...
```

### Step 3: TypeScript 타입 확인

컴파일 에러 없는지 확인:
```powershell
cd "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next"
npm run dev
```

---

## 🧪 테스트 시나리오

### 테스트 1: 사용자 역할 삭제 권한 확인

#### 준비
1. 사용자(0003) 역할로 로그인
2. 입고 관리 페이지 접속
3. 입고 내역 조회

#### 실행
- **그리드에서 품목 삭제**: "전체 삭제" 버튼 확인
- **저장된 내역 삭제**: 삭제 버튼 확인 (현재는 UI에 없음)

#### 예상 결과
```typescript
// hooks/usePermissions.ts
const { can } = usePermissions(userRole)

can('purchases_management', 'delete')
// 0000, 0001, 0002 → true
// 0003 → false ✅
```

#### 검증
```sql
-- TypeScript 권한 매트릭스 확인 (개발자 도구)
import { ROLE_PERMISSIONS } from '@/types/permissions'
console.log(ROLE_PERMISSIONS['0003'])
// 결과: delete 권한 없음 확인
```

---

### 테스트 2: 지점 격리 검증 (타 지점 조회 차단)

#### 준비
- 사용자 A: B01 지점 소속 (원장 또는 사용자, 시스템 관리자 아님)
- 테스트 데이터:
  - B01 지점: 입고 3건
  - B02 지점: 입고 5건

#### 실행
1. 사용자 A로 로그인
2. 입고 관리 페이지에서 **지점 선택: B02** 시도
3. 입고 내역 조회

#### 예상 결과
- **UI에서 B02 선택 시**: B01 데이터만 표시 (B02 무시됨)
- **직접 RPC 호출 시**: 
  ```typescript
  const { data } = await supabase.rpc('get_purchases_list', {
    p_branch_id: 'B02_UUID',  // 타 지점 시도
    p_user_id: userA_UUID
  })
  // 결과: B01 데이터 3건만 반환 (B02 데이터 없음)
  ```

#### 검증 SQL
```sql
-- 사용자 A의 지점 확인
SELECT id, username, role, branch_id 
FROM users 
WHERE username = 'userA';
-- 예: branch_id = 'B01_UUID', role = '0001'

-- RPC 함수 실행 (B02 시도)
SELECT * FROM get_purchases_list(
  'B02_UUID'::TEXT,
  NULL::DATE,
  NULL::DATE,
  'userA_UUID'::UUID
);
-- 예상: B01 데이터만 반환 (B02 데이터 0건)
```

---

### 테스트 3: 시스템 관리자 전체 지점 조회

#### 준비
- 사용자 B: 시스템 관리자(0000)
- 테스트 데이터: B01 3건, B02 5건

#### 실행
1. 사용자 B로 로그인
2. 지점 선택: **B02**
3. 입고 내역 조회

#### 예상 결과
- **B02 데이터 5건 정상 조회** ✅
- 시스템 관리자는 지점 격리 적용 안됨

#### 검증 SQL
```sql
-- 시스템 관리자로 B02 조회
SELECT * FROM get_purchases_list(
  'B02_UUID'::TEXT,
  NULL::DATE,
  NULL::DATE,
  'systemAdminUser_UUID'::UUID
);
-- 예상: B02 데이터 5건 반환
```

---

### 테스트 4: 재고 조회 권한 검증

#### 준비
- 사용자 C: B01 지점 소속

#### 실행
```typescript
// 타 지점 재고 조회 시도
const { data, error } = await supabase.rpc('get_inventory_by_branch', {
  p_branch_id: 'B02_UUID',
  p_user_id: userC_UUID
})
```

#### 예상 결과
```
❌ 에러: "권한 없음: 본인 지점(B01_UUID)의 재고만 조회 가능합니다."
```

#### 검증
```sql
-- 직접 RPC 호출
SELECT * FROM get_inventory_by_branch(
  'B02_UUID'::UUID,
  'userC_UUID'::UUID
);
-- 예상: EXCEPTION 발생
```

---

### 테스트 5: 하위 호환성 (기존 코드 동작)

#### 실행
```typescript
// 기존 3-파라미터 함수 호출 (p_user_id 없음)
const { data } = await supabase.rpc('get_purchases_list', {
  p_branch_id: 'B01_UUID',
  p_start_date: '2025-01-01',
  p_end_date: '2025-01-31'
  // p_user_id 생략
})
```

#### 예상 결과
- **정상 동작** ✅ (오버로딩으로 4-파라미터 함수 자동 호출)
- 단, 권한 검증은 스킵됨 (p_user_id = NULL)

---

## ✅ Phase 2 완료 체크리스트

### 데이터베이스
- [ ] `database/phase2_permission_enforcement.sql` Supabase에 등록
- [ ] 오버로딩된 함수 확인 (각 함수마다 3-param, 4-param 버전 존재)
- [ ] 기존 3-param 함수 호출 시 정상 동작 확인

### 애플리케이션
- [ ] TypeScript 컴파일 에러 없음
- [ ] `types/permissions.ts` 변경 확인 (0003 역할 delete 제거)

### 권한 테스트
- [ ] 테스트 1: 사용자(0003) 삭제 권한 없음 확인
- [ ] 테스트 2: 타 지점 조회 시도 → 본인 지점 데이터만 반환
- [ ] 테스트 3: 시스템 관리자 전체 지점 조회 가능
- [ ] 테스트 4: 재고 조회 권한 검증 (타 지점 차단)
- [ ] 테스트 5: 하위 호환성 (기존 코드 동작)

### 데이터 정합성
- [ ] `check_inventory_integrity()` 실행 → 0건 이슈
- [ ] Phase 1 테스트 재실행 (회귀 테스트)

---

## 🚨 주의사항

### 1. UI에서 삭제 버튼 숨기기 (별도 작업 필요)
- **현재 상태**: 권한만 수정됨, UI는 아직 삭제 버튼 표시
- **추가 작업**: `ProtectedAction` 컴포넌트로 조건부 렌더링
- **Phase 3 (Audit Log) 이후**: 삭제 기능 UI 추가 예정

### 2. Server Actions에 user_id 전달 (선택 사항)
- **현재**: 조회 RPC 함수에 p_user_id 전달 안함
- **개선**: Server Actions에서 세션 user_id를 RPC에 전달하면 더 안전
- **예시**:
  ```typescript
  // app/purchases/actions.ts
  export async function getPurchasesHistory(branchId, startDate, endDate, userId) {
    const { data } = await supabase.rpc('get_purchases_list', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_user_id: userId  // ✅ 추가
    })
  }
  ```

### 3. 기존 데이터 영향 없음
- RPC 함수만 변경, 테이블 구조 변경 없음
- 기존 입고/판매 데이터 그대로 유지

---

## 📞 다음 단계

Phase 2 테스트 완료 후:
1. 테스트 결과 리포트 (5개 테스트 시나리오)
2. 권한 체크 스크린샷
3. Phase 3 (Audit Log 시스템) 시작 승인 요청

**Phase 3 미리보기:**
- `audit_logs` 테이블 생성
- 수정/삭제 시 자동 로깅 (트리거)
- UI: 수정/삭제 이력 조회 페이지 (admin 전용)
- Soft Delete vs Hard Delete 결정
