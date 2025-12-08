# 원장 사용자 관리 권한 추가 가이드

> **작성일**: 2025년 12월 8일  
> **목적**: 원장(role: '0001')이 본인 지점 직원을 관리할 수 있도록 권한 추가

---

## 📋 변경 사항 요약

### 비즈니스 규칙
- ✅ 원장은 본인 지점의 매니저/직원만 **조회/등록/수정/삭제** 가능
- ✅ 다른 지점 직원은 볼 수 없음
- ✅ 다른 원장이나 시스템 관리자는 관리 불가
- ✅ 원장이 생성하는 사용자는 자동으로 본인 지점 소속

### 권한 매트릭스

| 작업 | 시스템관리자(0000) | 원장(0001) |
|------|-------------------|------------|
| 모든 사용자 조회 | ✅ | ❌ |
| 본인 지점 사용자 조회 | ✅ | ✅ |
| 시스템관리자 생성 | ✅ | ❌ |
| 원장 생성 | ✅ | ❌ |
| 매니저/사용자 생성 | ✅ | ✅ (본인 지점만) |
| 다른 지점 사용자 수정 | ✅ | ❌ |
| 본인 지점 사용자 수정 | ✅ | ✅ |
| 다른 지점 사용자 삭제 | ✅ | ❌ |
| 본인 지점 사용자 삭제 | ✅ | ✅ |

---

## 🗄️ 데이터베이스 적용

### ⚠️ 중요 사항

1. **에러 방지**: 기존 함수의 파라미터 정의가 달라서 에러가 발생할 수 있습니다.  
   새로운 SQL 파일은 모든 기존 함수를 명시적으로 삭제한 후 재생성합니다.

2. **필수 확장**: `pgcrypto` 확장이 필요합니다 (비밀번호 해시용).  
   SQL 파일에 자동으로 포함되어 있습니다.

---

### 방법 1: Supabase Dashboard (추천)

1. **Supabase Dashboard 접속**
   - https://supabase.com 로그인
   - 프로젝트 선택

2. **SQL Editor 실행**
   - 좌측 메뉴에서 `SQL Editor` 클릭
   - `New Query` 버튼 클릭

3. **SQL 실행**
   - `database/users_rpc_functions.sql` 파일 내용 **전체** 복사
   - SQL Editor에 붙여넣기
   - `Run` 버튼 클릭 (또는 `Ctrl + Enter`)
   - ✅ `pgcrypto` 확장이 자동으로 활성화됩니다

4. **실행 결과 확인**
   - ✅ "Success. No rows returned" 메시지 확인
   - 또는 하단에 함수 목록이 출력되면 성공

5. **함수 생성 확인**
   ```sql
   -- 이 쿼리를 별도로 실행하여 확인
   SELECT 
       p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS arguments
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'get_all_users',
       'create_user',
       'update_user',
       'delete_user',
       'update_user_password'
     )
   ORDER BY p.proname;
   ```

   **예상 결과**: 5개의 함수가 조회되어야 함

---

### 방법 2: psql CLI

```bash
# 1. SQL 파일 위치로 이동
cd database

# 2. psql 연결 (Supabase 연결 문자열 사용)
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# 3. SQL 파일 실행
\i users_rpc_functions.sql

# 4. 함수 확인
\df public.get_all_users
\df public.create_user
\df public.update_user
\df public.delete_user
```

---

### 🔧 에러 해결

#### **에러 1**: `cannot remove parameter defaults from existing function`

**원인**: 기존 함수와 새 함수의 파라미터 기본값이 달라서 발생

**해결 방법**:
1. 수정된 `database/users_rpc_functions.sql` 파일 사용 (기존 함수 명시적 삭제 포함)
2. 또는 수동으로 기존 함수 삭제 후 재실행:
   ```sql
   -- 기존 함수 모두 삭제
   DROP FUNCTION IF EXISTS get_all_users() CASCADE;
   DROP FUNCTION IF EXISTS get_all_users(TEXT, UUID) CASCADE;
   DROP FUNCTION IF EXISTS create_user(VARCHAR(50), TEXT, VARCHAR(100), VARCHAR(20), UUID, UUID) CASCADE;
   DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN) CASCADE;
   DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN, UUID, VARCHAR(20)) CASCADE;
   DROP FUNCTION IF EXISTS delete_user(UUID) CASCADE;
   DROP FUNCTION IF EXISTS delete_user(UUID, UUID, VARCHAR(20)) CASCADE;
   DROP FUNCTION IF EXISTS update_user_password(UUID, TEXT) CASCADE;
   
   -- 그 다음 users_rpc_functions.sql 전체 실행
   ```

---

#### **에러 2**: `function gen_salt(unknown, integer) does not exist`

**원인**: 
1. `pgcrypto` 확장이 활성화되지 않음 (비밀번호 해시에 필요)
2. 또는 `pgcrypto`는 설치되어 있지만 **스키마 경로 문제** (`extensions` 스키마에 있는데 `public`에서만 찾음)

**해결 방법**:

✅ **해결됨**: SQL 파일에 이미 수정 완료
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;` 포함
- 함수에 `SET search_path = public, extensions` 추가
- `extensions.crypt()`, `extensions.gen_salt()` 스키마 명시

**확인 방법**:
```sql
-- 1. pgcrypto 확장 확인
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';

-- 2. gen_salt 함수 위치 확인
SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'gen_salt';

-- 예상 결과: schema_name = 'extensions' (또는 'public')

-- 3. 테스트
SELECT extensions.gen_salt('bf', 10);  -- extensions 스키마에서
-- 또는
SELECT gen_salt('bf', 10);  -- search_path에 포함되어 있으면
```

**수동 해결 (필요한 경우)**:
```sql
-- 방법 A: 함수에서 스키마 명시 (이미 적용됨)
CREATE OR REPLACE FUNCTION create_user(...)
...
SET search_path = public, extensions  -- ✅ extensions 스키마 추가
...
v_hashed_password := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
```

---

## 🔍 테스트 방법

### 1. 시스템 관리자로 테스트

```sql
-- 모든 사용자 조회 (전체)
SELECT * FROM get_all_users('0000', NULL);
```

**예상 결과**: 모든 사용자 조회됨

---

### 2. 원장으로 테스트

```sql
-- 1. 원장의 branch_id 확인
SELECT id, username, role, branch_id FROM users WHERE role = '0001';

-- 2. 해당 원장으로 사용자 조회 (본인 지점만)
SELECT * FROM get_all_users('0001', '원장의-branch-id');
```

**예상 결과**: 
- ✅ 본인 지점의 매니저(0002), 직원(0003)만 조회
- ❌ 다른 지점 사용자 조회 불가
- ❌ 다른 원장(0001), 시스템관리자(0000) 조회 불가

---

### 3. 원장이 사용자 생성

```sql
-- 1. 원장 정보 확인
SELECT id, username, role, branch_id FROM users WHERE role = '0001' LIMIT 1;

-- 2. 원장이 직원 생성 (본인 지점으로 자동 설정)
SELECT * FROM create_user(
  'test_employee',       -- 아이디
  'password123',         -- 비밀번호
  '테스트 직원',         -- 표시 이름
  '0003',                -- 직원 권한
  NULL,                  -- branch_id (NULL이어도 원장의 지점으로 설정됨)
  '원장의-user-id'       -- 생성자 ID
);
```

**예상 결과**: 
- ✅ 사용자 생성 성공
- ✅ 생성된 사용자의 branch_id가 원장의 branch_id와 동일

---

### 4. 원장이 권한 높은 사용자 생성 시도 (실패 테스트)

```sql
-- 원장이 시스템 관리자 생성 시도 (실패해야 함)
SELECT * FROM create_user(
  'test_admin',
  'password123',
  '테스트 관리자',
  '0000',               -- 시스템 관리자 권한
  NULL,
  '원장의-user-id'
);
```

**예상 결과**: 
```
ERROR: 원장은 시스템 관리자나 원장을 생성할 수 없습니다.
```

---

### 5. 원장이 다른 지점 사용자 수정 시도 (실패 테스트)

```sql
-- 1. 다른 지점 사용자 ID 확인
SELECT id, username, branch_id FROM users 
WHERE branch_id != (SELECT branch_id FROM users WHERE role = '0001' LIMIT 1)
LIMIT 1;

-- 2. 원장이 다른 지점 사용자 수정 시도 (실패해야 함)
SELECT * FROM update_user(
  '다른-지점-사용자-id',
  '수정된 이름',
  '0003',
  NULL,
  TRUE,
  '원장의-user-id',
  '0001'
);
```

**예상 결과**: 
```
ERROR: 다른 지점 사용자는 수정할 수 없습니다.
```

---

## 🖥️ 프론트엔드 테스트

### 1. 시스템 관리자로 로그인
1. 시스템 관리자 계정으로 로그인
2. `사용자 관리` 메뉴 접속
3. **확인 사항**:
   - ✅ 모든 지점의 사용자가 보임
   - ✅ 모든 권한(0000, 0001, 0002, 0003) 생성 가능
   - ✅ 지점 선택 드롭다운 표시

---

### 2. 원장으로 로그인
1. 원장 계정으로 로그인
2. `사용자 관리` 메뉴 접속
3. **확인 사항**:
   - ✅ 본인 지점의 매니저/직원만 보임
   - ✅ "본인 지점의 직원을 관리합니다" 안내 메시지
   - ✅ "📍 [지점명] 전용" 표시
   - ✅ 사용자 추가 시 권한 선택에 "매니저", "직원"만 표시
   - ✅ 지점 선택 드롭다운이 본인 지점으로 고정 (disabled)
   - ✅ "본인 지점으로 자동 설정" 안내 메시지

---

### 3. 원장이 사용자 생성
1. "➕ 새 사용자 추가" 버튼 클릭
2. 폼 작성:
   - 아이디: test_manager
   - 비밀번호: password123
   - 표시 이름: 테스트 매니저
   - 권한: 매니저 (0002 또는 0003만 선택 가능)
   - 소속 지점: (자동으로 본인 지점 설정됨, disabled)
3. "저장" 클릭
4. **예상 결과**: 
   - ✅ 사용자 생성 성공 메시지
   - ✅ 생성된 사용자가 목록에 표시됨
   - ✅ 생성된 사용자의 소속 지점이 원장의 지점과 동일

---

## 📁 변경된 파일 목록

### 1. 권한 설정
- ✅ `types/permissions.ts`
  - '0001' 권한에 `users_management` CRUD 추가

### 2. 데이터베이스
- ✅ `database/users_rpc_functions.sql`
  - `get_all_users()` → `get_all_users(p_user_role, p_user_branch_id)` 수정
  - `create_user()` 권한 검증 추가
  - `update_user()` 권한 검증 추가
  - `delete_user()` 권한 검증 추가

### 3. Server Actions
- ✅ `app/admin/users/actions.ts`
  - `getUsers()` - 현재 사용자 role, branch_id 전달
  - `saveUser()` - 현재 사용자 정보를 RPC에 전달
  - `deleteUser()` - 현재 사용자 정보를 RPC에 전달

### 4. 페이지
- ✅ `app/admin/users/page.tsx`
  - 원장일 때 안내 메시지 추가
  - "본인 지점 전용" 표시

### 5. 컴포넌트
- ✅ `components/admin/users/UserForm.tsx`
  - 원장일 때 권한 선택 제한 (0002, 0003만)
  - 원장일 때 지점 선택 비활성화 (본인 지점 고정)
  
- ✅ `components/admin/users/UserManagement.tsx`
  - `currentUser` prop 추가하여 `UserForm`에 전달

---

## ✅ 배포 체크리스트

- [ ] `database/users_rpc_functions.sql` Supabase에서 실행
- [ ] 함수 생성 확인 쿼리 실행
- [ ] 시스템 관리자로 로그인 테스트
- [ ] 원장으로 로그인 테스트
- [ ] 원장이 사용자 생성 테스트
- [ ] 원장이 다른 지점 사용자 접근 시도 (실패 확인)
- [ ] 원장이 시스템관리자/원장 생성 시도 (실패 확인)
- [ ] `npm run build` 성공 확인
- [ ] 프로덕션 배포

---

## 🔄 롤백 방법 (문제 발생 시)

### SQL 롤백

```sql
-- 1. 새 함수 삭제
DROP FUNCTION IF EXISTS get_all_users(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_user(VARCHAR(50), TEXT, VARCHAR(100), VARCHAR(20), UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS update_user(UUID, VARCHAR(100), VARCHAR(20), UUID, BOOLEAN, UUID, VARCHAR(20)) CASCADE;
DROP FUNCTION IF EXISTS delete_user(UUID, UUID, VARCHAR(20)) CASCADE;
DROP FUNCTION IF EXISTS update_user_password(UUID, TEXT) CASCADE;

-- 2. 기존 함수 복원
-- Git에서 이전 버전의 users_rpc_functions.sql 찾아서 실행
-- 또는 백업한 SQL 파일 실행
```

### 코드 롤백

```bash
# Git에서 변경사항 되돌리기
git checkout HEAD~1 -- types/permissions.ts
git checkout HEAD~1 -- app/admin/users/actions.ts
git checkout HEAD~1 -- app/admin/users/page.tsx
git checkout HEAD~1 -- components/admin/users/UserForm.tsx
git checkout HEAD~1 -- components/admin/users/UserManagement.tsx

# 재배포
npm run build
```

---

## 📞 문의 및 지원

문제 발생 시:
1. SQL 실행 에러 로그 확인
2. 브라우저 콘솔 에러 확인
3. 서버 로그 확인 (`npm run dev` 터미널)

---

**작업 완료!** 🎉

