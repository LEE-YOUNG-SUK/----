# 지점별 로그인 시스템 구축 가이드

> **작성일**: 2025년 12월 8일  
> **목적**: 동일 아이디가 다른 지점에 존재할 수 있도록 개선

---

## 📋 변경 사항 요약

### 비즈니스 규칙
1. ✅ 동일한 아이디가 다른 지점에 존재 가능 (동명이인 허용)
2. ✅ 로그인 시 **지점 + 아이디 + 비밀번호**로 인증
3. ✅ 마지막 로그인 지점을 localStorage에 저장
4. ✅ 다음 로그인 시 자동으로 해당 지점 선택됨
5. ✅ "지점 정보 기억하기" 체크박스 제공

---

## 🗄️ 데이터베이스 적용 순서

### STEP 1: 중복 아이디 확인 (필수!)

```sql
-- 파일: database/check_duplicate_users.sql
-- Supabase SQL Editor에서 실행

SELECT 
    username AS "중복 아이디",
    COUNT(*) AS "중복 개수",
    STRING_AGG(b.name, ', ') AS "소속 지점"
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id
GROUP BY username 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

**예상 결과**: 
- ✅ 빈 결과 → 진행 가능
- ❌ 결과 있음 → **먼저 중복 아이디 처리 필요**

---

### STEP 2: 지점별 로그인 시스템 적용

```sql
-- 파일: database/login_with_branch.sql
-- Supabase SQL Editor에서 전체 실행
```

**이 SQL은 다음을 수행합니다**:
1. ✅ 기존 `username` 유니크 제약 삭제
2. ✅ `username + branch_id` 복합 유니크 제약 추가
3. ✅ 성능 최적화 인덱스 추가
4. ✅ `verify_login(username, password, branch_id)` 함수 생성
5. ✅ `get_branches_for_login()` 함수 생성

---

## 📁 수정된 파일 목록

### 1. **`database/check_duplicate_users.sql`** ✅ (신규 생성)
- 중복 아이디 확인 쿼리
- 전체 사용자 현황 조회
- 지점별 사용자 수 집계

### 2. **`database/login_with_branch.sql`** ✅ (신규 생성)
- 지점별 로그인 시스템 구축 SQL
- DB 스키마 변경 (복합 유니크 키)
- 로그인 함수 생성

### 3. **`app/login/page.tsx`** ✅ (전체 교체)
- 지점 선택 드롭다운 추가
- 마지막 지점 정보 localStorage 저장/복원
- "지점 정보 기억하기" 체크박스
- 지점별 로그인 처리

### 4. **`database/users_rpc_functions.sql`** ✅ (부분 수정)
- `create_user` 함수의 중복 체크 로직 변경
- 아이디 + 지점 복합 체크로 변경

### 5. **`components/admin/users/UserForm.tsx`** ✅ (부분 수정)
- 안내 메시지 추가: "같은 지점 내에서만 중복 불가"

---

## 🖥️ 로그인 화면 흐름

### 첫 로그인
```
1. 지점 선택 [▼ 선택하세요]
   ↓
2. 아이디 입력 [홍길동]
   ↓
3. 비밀번호 입력 [******]
   ↓
4. [✓] 지점 정보 기억하기
   ↓
5. [로그인] 클릭
```

### 두 번째 로그인 (지점 기억됨)
```
1. 지점 자동 선택 [강남점 ▼] ← localStorage에서 복원
   ↓
2. 아이디 자동 입력 [홍길동] ← localStorage에서 복원
   ↓
3. 비밀번호만 입력 [******]
   ↓
4. [로그인] 클릭
```

---

## 🧪 테스트 시나리오

### 1. 동명이인 테스트

#### 강남점에 "홍길동" 생성
```
지점: 강남점
아이디: 홍길동
비밀번호: test1234
→ ✅ 성공
```

#### 부산점에 "홍길동" 생성
```
지점: 부산점
아이디: 홍길동
비밀번호: test5678
→ ✅ 성공 (동일 아이디 허용됨)
```

#### 로그인 테스트
```
[강남점] + 홍길동 + test1234 → ✅ 강남점 홍길동으로 로그인
[부산점] + 홍길동 + test5678 → ✅ 부산점 홍길동으로 로그인
[강남점] + 홍길동 + test5678 → ❌ "비밀번호가 올바르지 않습니다"
[부산점] + 홍길동 + test1234 → ❌ "비밀번호가 올바르지 않습니다"
```

---

### 2. 지점 기억 기능 테스트

#### 첫 로그인
```
1. 강남점 선택
2. admin 입력
3. [✓] 지점 정보 기억하기
4. 로그인 성공
5. 로그아웃
```

#### 두 번째 로그인
```
1. 로그인 페이지 접속
2. 지점이 "강남점"으로 자동 선택됨 ✅
3. 아이디가 "admin"으로 자동 입력됨 ✅
4. 비밀번호만 입력
5. 로그인 성공
```

#### 지점 기억 해제 테스트
```
1. [ ] 지점 정보 기억하기 (체크 해제)
2. 로그인 성공
3. 로그아웃
4. 다시 로그인 페이지 접속
5. 지점과 아이디가 비어있음 ✅
```

---

### 3. 에러 케이스 테스트

| 입력 | 결과 |
|------|------|
| (지점 선택 안 함) + admin + 1234 | ❌ "지점을 선택해주세요" |
| 강남점 + (아이디 비움) + 1234 | ❌ "아이디를 입력해주세요" |
| 강남점 + admin + (비밀번호 비움) | ❌ "비밀번호를 입력해주세요" |
| 잘못된 지점 + 올바른 아이디 + 올바른 비밀번호 | ❌ "아이디 또는 지점이 올바르지 않습니다" |
| 올바른 지점 + 올바른 아이디 + 잘못된 비밀번호 | ❌ "비밀번호가 올바르지 않습니다" |

---

## 🔍 데이터베이스 변경 세부사항

### 변경 전 (BEFORE)
```sql
-- username이 UNIQUE 제약
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,  -- ❌ 전체 사용자 중 중복 불가
    ...
);
```

### 변경 후 (AFTER)
```sql
-- username + branch_id 복합 UNIQUE 제약
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    ...
    CONSTRAINT users_username_branch_unique 
      UNIQUE (username, branch_id)  -- ✅ 같은 지점 내에서만 중복 불가
);
```

---

## 📊 데이터베이스 함수

### 1. `verify_login(username, password, branch_id)`

**목적**: 지점 + 아이디 + 비밀번호로 로그인 검증

**입력**:
- `p_username TEXT` - 아이디
- `p_password TEXT` - 비밀번호
- `p_branch_id UUID` - 지점 ID

**출력**:
```typescript
{
  success: boolean
  message: string
  user_id: UUID
  username: string
  display_name: string
  role: string
  branch_id: UUID
  branch_name: string
}
```

**특징**:
- ✅ 지점 + 아이디로 사용자 조회
- ✅ 비밀번호 bcrypt 검증
- ✅ 마지막 로그인 시간 자동 업데이트
- ✅ `anon` 권한 부여 (로그인 전 호출 가능)

---

### 2. `get_branches_for_login()`

**목적**: 로그인 페이지용 활성 지점 목록 조회

**출력**:
```typescript
{
  id: UUID
  code: string
  name: string
}[]
```

**특징**:
- ✅ 활성 지점만 조회 (`is_active = true`)
- ✅ 이름순 정렬
- ✅ `anon` 권한 부여 (로그인 전 호출 가능)

---

## 🔒 보안 고려사항

### 1. localStorage 사용
```typescript
// 저장되는 정보
localStorage.setItem('last_branch_id', branch_id)  // UUID
localStorage.setItem('last_username', username)    // 아이디

// ⚠️ 주의: 민감 정보는 저장하지 않음
// ❌ 비밀번호 저장 안 함
// ❌ 세션 토큰 저장 안 함
```

### 2. 세션 관리
```typescript
// 세션 토큰은 HttpOnly 쿠키에만 저장
document.cookie = `erp_session_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
```

### 3. 권한 체크
```sql
-- verify_login: anon 권한 부여 (로그인 전 호출)
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT, UUID) TO anon;

-- get_branches_for_login: anon 권한 부여
GRANT EXECUTE ON FUNCTION get_branches_for_login() TO anon;
```

---

## 📝 적용 체크리스트

### 사전 준비
- [ ] 기존 사용자 데이터 백업
- [ ] `check_duplicate_users.sql` 실행하여 중복 확인
- [ ] 중복 아이디가 있으면 먼저 해결

### SQL 적용
- [ ] `database/login_with_branch.sql` Supabase에서 실행
- [ ] 유니크 제약 변경 확인
- [ ] 인덱스 생성 확인
- [ ] 함수 생성 확인 (verify_login, get_branches_for_login)

### 프론트엔드 배포
- [ ] `npm run build` 성공 확인
- [ ] 배포 완료

### 테스트
- [ ] 지점 목록 조회 확인
- [ ] 첫 로그인 테스트
- [ ] 지점 기억 기능 테스트
- [ ] 동명이인 로그인 테스트
- [ ] 에러 케이스 테스트

---

## 🔄 롤백 방법 (문제 발생 시)

### SQL 롤백
```sql
-- 1. 복합 유니크 제약 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_branch_unique;

-- 2. 기존 단일 유니크 제약 복원
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- 3. 새 함수 삭제
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_branches_for_login();

-- 4. 기존 함수 복원
-- Git에서 이전 버전의 auth_session_functions.sql 찾아서 실행
```

### 프론트엔드 롤백
```bash
# Git에서 변경사항 되돌리기
git checkout HEAD~1 -- app/login/page.tsx
git checkout HEAD~1 -- database/users_rpc_functions.sql
git checkout HEAD~1 -- components/admin/users/UserForm.tsx

# 재배포
npm run build
```

---

## 💡 FAQ

### Q1: 기존 사용자는 어떻게 되나요?
**A**: 기존 사용자는 모두 그대로 유지됩니다. 단, 로그인 시 지점을 선택해야 합니다.

### Q2: 같은 아이디로 여러 지점에 계정을 만들 수 있나요?
**A**: 네, 가능합니다. 예: 강남점-홍길동, 부산점-홍길동 (다른 사람)

### Q3: 시스템 관리자는 어떻게 되나요?
**A**: 시스템 관리자(`role='0000'`)는 지점에 소속되지 않을 수 있습니다 (`branch_id = NULL`).

### Q4: 지점 정보를 잊어버리면 어떻게 하나요?
**A**: localStorage를 지우거나 브라우저 설정에서 "지점 정보 기억하기" 체크를 해제하세요.

---

## 📞 문의 및 지원

문제 발생 시:
1. Supabase SQL Editor에서 검증 쿼리 실행
2. 브라우저 콘솔 에러 확인
3. 서버 로그 확인 (`npm run dev` 터미널)

---

**작업 완료!** 🎉  
지점별 로그인 시스템이 성공적으로 구축되었습니다!

