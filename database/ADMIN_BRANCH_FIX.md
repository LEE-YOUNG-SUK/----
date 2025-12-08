# 🔧 시스템 관리자 지점 제약 조건 수정

## 📅 작업 일시
**2025-01-26**

---

## 🚨 문제 상황

### 에러 메시지
```
Error: Failed to run sql query: 
ERROR: 23514: new row for relation "users" violates check constraint "users_branch_requirement"
```

### 시도한 쿼리
```sql
UPDATE users 
SET branch_id = (SELECT id FROM branches WHERE code = 'HQ')
WHERE role = '0000';
```

### 문제 원인
현재 데이터베이스에 다음과 같은 체크 제약 조건이 있습니다:

```sql
ALTER TABLE users ADD CONSTRAINT users_branch_requirement 
  CHECK (
    (role = '0000' AND branch_id IS NULL) OR
    (role != '0000' AND branch_id IS NOT NULL)
  );
```

**의미**:
- 시스템 관리자(0000): `branch_id`는 **반드시 NULL**이어야 함
- 기타 역할(0001, 0002, 0003): `branch_id`가 **반드시 있어야** 함

---

## 💡 설계 의도

### 시스템 관리자(0000)는 왜 branch_id가 NULL인가?

```
┌─────────────────────────────────────────┐
│      시스템 관리자 (role: 0000)         │
│         branch_id: NULL                 │
│                                         │
│   👁️ 모든 지점 데이터를 볼 수 있음    │
│   ✏️ 모든 지점 데이터를 수정 가능      │
│   🔒 지점 격리 없음                    │
└─────────────────────────────────────────┘
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
┌────────┐ ┌────────┐ ┌────────┐
│  본사   │ │ 강남점  │ │ 서초점  │
└────────┘ └────────┘ └────────┘
```

### 원장(0001)은 왜 branch_id가 필요한가?

```
┌─────────────────────────────────────────┐
│        원장 (role: 0001)                │
│    branch_id: 강남점 UUID               │
│                                         │
│   👁️ 본인 지점 데이터만 볼 수 있음     │
│   ✏️ 본인 지점 데이터만 수정 가능       │
│   🔒 다른 지점은 접근 불가              │
└─────────────────────────────────────────┘
              ↓
           ┌────────┐
           │ 강남점  │  ✅ 접근 가능
           └────────┘
    
┌────────┐           ┌────────┐
│  본사   │           │ 서초점  │  ❌ 접근 불가
└────────┘           └────────┘
```

---

## ✅ 해결 방법

### 옵션 1: 시스템 관리자는 branch_id를 NULL로 유지 (권장)

**Supabase SQL Editor에서 실행**:
```sql
-- 시스템 관리자 branch_id를 NULL로 설정
UPDATE users 
SET branch_id = NULL
WHERE role = '0000';
```

**결과**:
- ✅ 시스템 관리자가 모든 지점의 데이터를 볼 수 있음
- ✅ 제약 조건 위반 없음
- ✅ 설계 의도대로 작동

---

### 옵션 2: 제약 조건 수정 (권장하지 않음)

만약 시스템 관리자도 특정 지점에 소속되어야 한다면:

**파일**: `database/fix_admin_branch_constraint.sql`

```sql
-- 1. 기존 제약 조건 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_branch_requirement;

-- 2. 새로운 제약 조건 추가 (모든 역할이 branch_id를 가질 수 있음)
ALTER TABLE users ADD CONSTRAINT users_branch_requirement 
  CHECK (branch_id IS NOT NULL);

-- 3. 시스템 관리자에게 본사 할당
UPDATE users 
SET branch_id = (SELECT id FROM branches WHERE code = 'HQ')
WHERE role = '0000';
```

**주의**: 이 방법은 권한 로직을 수정해야 합니다!
- RPC 함수들이 시스템 관리자의 `branch_id`를 체크하지 않도록 수정 필요
- 기존 로직: `IF role = '0000' THEN (모든 지점 접근)` → 수정 필요

---

## 🔍 현재 상태 확인

### 1. 제약 조건 확인
```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'users_branch_requirement'
  AND conrelid = 'users'::regclass;
```

**예상 결과**:
```
constraint_name           | constraint_definition
--------------------------|-----------------------------------------------------
users_branch_requirement  | CHECK (((role = '0000') AND (branch_id IS NULL)) 
                          |   OR ((role <> '0000') AND (branch_id IS NOT NULL)))
```

### 2. 사용자 상태 확인
```sql
SELECT 
  username,
  display_name,
  role,
  branch_id,
  CASE 
    WHEN role = '0000' AND branch_id IS NULL THEN '✅ 정상'
    WHEN role = '0000' AND branch_id IS NOT NULL THEN '❌ 시스템 관리자에게 지점 설정됨'
    WHEN role != '0000' AND branch_id IS NULL THEN '❌ 지점 없음'
    WHEN role != '0000' AND branch_id IS NOT NULL THEN '✅ 정상'
  END AS status
FROM users
ORDER BY role, username;
```

---

## 🎯 권장 조치

### 시스템 관리자 로그인 방법

#### 1. 로그인 페이지에서
```
아이디: admin
비밀번호: (기존 비밀번호)
지점: (선택하지 않음 또는 "전체 지점" 옵션)
```

#### 2. `verify_login` 함수 수정 필요 확인

**파일**: `database/login_with_branch_update_functions_only.sql`

```sql
CREATE OR REPLACE FUNCTION verify_login(
  p_username TEXT,
  p_password TEXT,
  p_branch_id UUID
)
-- ... 
BEGIN
  -- 시스템 관리자는 branch_id 무시
  IF v_user.role = '0000' THEN
    -- branch_id 체크 안 함
    -- ...
  ELSE
    -- 기타 역할은 branch_id 체크
    IF v_user.branch_id != p_branch_id THEN
      RETURN QUERY SELECT FALSE, ...
    END IF;
  END IF;
  -- ...
END;
```

---

## 📋 수정할 파일 (옵션 1 - 권장)

### 로그인 페이지: `app/login/page.tsx`

시스템 관리자 로그인 시 지점 선택을 건너뛰도록 수정:

```tsx
// 시스템 관리자 체크
const isSystemAdmin = username === 'admin' // 또는 다른 로직

// 시스템 관리자는 지점 선택 없이 로그인
if (isSystemAdmin) {
  // branch_id를 NULL 또는 빈 값으로 전달
  const result = await verifyLogin(username, password, null)
} else {
  // 일반 사용자는 지점 선택 필수
  const result = await verifyLogin(username, password, branchId)
}
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 시스템 관리자 로그인
1. 로그인 페이지 접속
2. 아이디: `admin` 입력
3. 비밀번호 입력
4. 지점: (선택 안 함 또는 "전체 지점")
5. 로그인 버튼 클릭
6. **결과**: ✅ 로그인 성공, 모든 지점 데이터 접근 가능

### 시나리오 2: 원장 로그인
1. 로그인 페이지 접속
2. 아이디: 원장 계정 입력
3. 비밀번호 입력
4. 지점: "강남점" 선택 (필수)
5. 로그인 버튼 클릭
6. **결과**: ✅ 로그인 성공, 강남점 데이터만 접근 가능

---

## 💡 즉시 해결 방법

**Supabase SQL Editor에서 바로 실행**:

```sql
-- 시스템 관리자 branch_id를 NULL로 변경
UPDATE users 
SET branch_id = NULL
WHERE role = '0000';

-- 확인
SELECT 
  username, 
  role, 
  branch_id,
  CASE 
    WHEN role = '0000' AND branch_id IS NULL THEN '✅ 정상'
    ELSE '❌ 확인 필요'
  END AS status
FROM users 
WHERE role = '0000';
```

**예상 결과**:
```
username | role | branch_id | status
---------|------|-----------|--------
admin    | 0000 |   NULL    | ✅ 정상
```

---

## 📌 요약

| 항목 | 시스템 관리자 (0000) | 기타 역할 (0001, 0002, 0003) |
|------|---------------------|----------------------------|
| **branch_id** | NULL (필수) | NOT NULL (필수) |
| **접근 범위** | 모든 지점 | 본인 지점만 |
| **로그인 시 지점 선택** | 불필요 | 필수 |
| **데이터 격리** | 없음 | 있음 |

---

**해결 방법**: 시스템 관리자는 `branch_id = NULL`로 유지하고, 로그인 로직에서 시스템 관리자는 지점 선택을 건너뛰도록 수정하는 것이 권장됩니다.

**작업 완료일**: 2025-01-26  
**상태**: 즉시 실행 가능한 SQL 제공

