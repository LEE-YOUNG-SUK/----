# Phase 2 배포 가이드

## ✅ 수정 완료 사항

### 1. SQL 파일 수정
- **파일**: `database/phase2_permission_enforcement.sql`
- **변경**: 3-파라미터 오버로딩 함수 제거 (PGRST203 에러 해결)
- **최종**: 4-파라미터 함수만 유지 (p_user_id 필수)

### 2. Server Actions 수정
- **파일**: `app/purchases/actions.ts`
  ```typescript
  // Before
  getPurchasesHistory(branchId, startDate?, endDate?)
  
  // After  
  getPurchasesHistory(branchId, userId, startDate?, endDate?)
  ```

- **파일**: `app/sales/actions.ts`
  ```typescript
  // Before
  getSalesHistory(branchId, startDate?, endDate?)
  
  // After
  getSalesHistory(branchId, userId, startDate?, endDate?)
  ```

### 3. 페이지 컴포넌트 수정
- **파일**: `app/purchases/page.tsx`
  ```typescript
  getPurchasesHistory(userSession.branch_id, userSession.user_id)
  ```

- **파일**: `app/sales/page.tsx`
  ```typescript
  getSalesHistory(userSession.branch_id, userSession.user_id)
  ```

---

## 🚀 배포 절차

### Step 1: Supabase에 SQL 실행

1. **Supabase Dashboard** 접속
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **SQL Editor** 열기
   - 좌측 메뉴 → SQL Editor 클릭

3. **SQL 스크립트 실행**
   - `database/phase2_permission_enforcement.sql` 파일 내용 전체 복사
   - SQL Editor에 붙여넣기
   - **Run** 버튼 클릭 (Ctrl+Enter)

4. **예상 출력 (성공 시)**
   ```
   DROP FUNCTION (get_purchases_list 3-param)
   CREATE FUNCTION (get_purchases_list 4-param)
   DROP FUNCTION (get_sales_list 3-param)
   CREATE FUNCTION (get_sales_list 4-param)
   DROP FUNCTION (get_inventory_by_branch 1-param)
   CREATE FUNCTION (get_inventory_by_branch 2-param)
   GRANT EXECUTE (3 functions)
   ```

---

### Step 2: 함수 검증

SQL Editor에서 다음 쿼리 실행:

```sql
-- 1. 함수 시그니처 확인
SELECT 
  proname AS function_name,
  pronargs AS param_count,
  pg_get_function_arguments(oid) AS parameters
FROM pg_proc
WHERE proname IN ('get_purchases_list', 'get_sales_list', 'get_inventory_by_branch')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname, pronargs;
```

**예상 결과:**
```
function_name          | param_count | parameters
-----------------------|-------------|------------------------------------------------
get_inventory_by_branch| 2           | p_branch_id uuid, p_user_id uuid DEFAULT NULL
get_purchases_list     | 4           | p_branch_id text DEFAULT NULL, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL, p_user_id uuid DEFAULT NULL
get_sales_list         | 4           | p_branch_id text DEFAULT NULL, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL, p_user_id uuid DEFAULT NULL
```

**중요**: 각 함수마다 **1개의 버전만** 존재해야 합니다. 2개 이상이면 오버로딩 에러 발생합니다.

---

### Step 3: 애플리케이션 재시작

```powershell
# 개발 서버 재시작
cd "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next"
npm run dev
```

---

## 🧪 테스트 시나리오

### 테스트 1: 기본 조회 기능

1. **입고 관리 페이지 접속**
   - URL: http://localhost:3000/purchases
   - 예상: 페이지 정상 로드, 입고 내역 표시

2. **판매 관리 페이지 접속**
   - URL: http://localhost:3000/sales
   - 예상: 페이지 정상 로드, 판매 내역 표시

3. **오류 확인**
   - 브라우저 개발자 도구 (F12) → Console 탭
   - 예상: `PGRST203` 에러 없음 ✅

---

### 테스트 2: 지점 격리 검증

#### 준비
- **사용자 A**: B01 지점 소속 (원장 또는 사용자)
- **사용자 B**: B02 지점 소속 (원장 또는 사용자)
- **시스템 관리자**: 전체 지점 접근 가능

#### 실행
1. 사용자 A로 로그인
2. 입고 관리 페이지에서 **지점 선택: B02** 시도
3. 입고 내역 조회

#### 예상 결과
- **사용자 A**: B01 데이터만 표시 (B02 선택해도 무시됨) ✅
- **시스템 관리자**: B02 데이터 정상 조회 ✅

---

### 테스트 3: Supabase 직접 테스트

SQL Editor에서 직접 RPC 함수 호출:

```sql
-- 1. 테스트용 사용자 ID 확인
SELECT id, username, role, branch_id 
FROM users 
WHERE username = 'test_user';
-- 결과 예: id = 'user_uuid', role = '0001', branch_id = 'B01_uuid'

-- 2. 본인 지점 조회 (정상)
SELECT * FROM get_purchases_list(
  NULL::TEXT,          -- p_branch_id
  NULL::DATE,          -- p_start_date
  NULL::DATE,          -- p_end_date
  'user_uuid'::UUID    -- p_user_id
);
-- 예상: B01 데이터 반환

-- 3. 타 지점 조회 시도 (차단)
SELECT * FROM get_purchases_list(
  'B02_uuid'::TEXT,    -- 다른 지점 시도
  NULL::DATE,
  NULL::DATE,
  'user_uuid'::UUID
);
-- 예상: B01 데이터 반환 (B02 무시됨)

-- 4. 시스템 관리자 테스트
SELECT id, username, role FROM users WHERE role = '0000';
-- admin_uuid 확인

SELECT * FROM get_purchases_list(
  'B02_uuid'::TEXT,
  NULL::DATE,
  NULL::DATE,
  'admin_uuid'::UUID
);
-- 예상: B02 데이터 정상 반환
```

---

## ✅ 완료 체크리스트

### SQL 배포
- [ ] Supabase SQL Editor에서 `phase2_permission_enforcement.sql` 실행
- [ ] 함수 시그니처 검증 쿼리 실행 (각 함수 1개 버전만 존재)
- [ ] 기존 3-파라미터 함수 완전 삭제 확인

### 애플리케이션
- [ ] 개발 서버 재시작 (`npm run dev`)
- [ ] TypeScript 컴파일 에러 없음
- [ ] 브라우저 Console에 `PGRST203` 에러 없음

### 기능 테스트
- [ ] 입고 관리 페이지 정상 로드
- [ ] 판매 관리 페이지 정상 로드
- [ ] 입고 내역 조회 성공
- [ ] 판매 내역 조회 성공

### 권한 테스트
- [ ] 사용자(0001/0002/0003)가 타 지점 조회 시도 → 본인 지점 데이터만 반환
- [ ] 시스템 관리자(0000)가 모든 지점 조회 가능
- [ ] SQL Editor에서 RPC 직접 호출 테스트 성공

### 데이터 정합성
- [ ] Phase 1 테스트 재실행 (회귀 테스트)
- [ ] `check_inventory_integrity()` 실행 → 0건 이슈

---

## 🚨 문제 해결

### PGRST203 에러 재발 시

```sql
-- 1. 오버로딩 함수 확인
SELECT proname, pronargs FROM pg_proc 
WHERE proname IN ('get_purchases_list', 'get_sales_list');

-- 2. 중복 함수 강제 삭제
DROP FUNCTION IF EXISTS get_purchases_list(TEXT, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_sales_list(TEXT, DATE, DATE) CASCADE;

-- 3. phase2_permission_enforcement.sql 재실행
```

### 데이터 조회 실패 시

```sql
-- 사용자 ID가 NULL인지 확인
-- app/purchases/page.tsx에서 userSession.user_id 전달 확인
```

---

## 📞 다음 단계

Phase 2 테스트 완료 후:
1. 테스트 결과 리포트 (3가지 테스트 시나리오)
2. 스크린샷 또는 로그 첨부
3. **Phase 3 (Audit Log 시스템)** 시작 승인 요청
