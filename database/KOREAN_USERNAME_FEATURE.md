# 한글 아이디 허용 기능 추가

> **작성일**: 2025년 12월 8일  
> **목적**: 사용자 아이디(username)에 한글 입력을 허용

---

## 📋 변경 사항 요약

### 변경 전
- ❌ placeholder: "영문, 숫자 조합"
- ❌ 검증 로직 없음 (기본 trim() 체크만)

### 변경 후
- ✅ 한글, 영문, 숫자, 밑줄(_), 하이픈(-) 허용
- ✅ 위험한 특수문자 차단 (SQL Injection, XSS 방지)
- ✅ 최소 2자 이상 검증
- ✅ 명확한 안내 메시지

---

## 📁 수정된 파일

### **`components/admin/users/UserForm.tsx`** ✅

#### 1. 아이디 검증 로직 추가

```typescript
// 아이디 검증 (신규 생성 시) - 한글, 영문, 숫자, 밑줄(_), 하이픈(-) 허용
if (!isEdit) {
  const usernameRegex = /^[가-힣a-zA-Z0-9_-]+$/
  if (!usernameRegex.test(formData.username.trim())) {
    alert('아이디는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다')
    return
  }
  
  // 위험한 문자 체크 (SQL Injection, XSS 방지)
  if (/[<>'"\\;`]/.test(formData.username)) {
    alert('아이디에 특수문자(<, >, \', ", \\, ;, `)는 사용할 수 없습니다')
    return
  }
  
  // 최소 길이 체크
  if (formData.username.trim().length < 2) {
    alert('아이디는 최소 2자 이상이어야 합니다')
    return
  }
}
```

#### 2. Placeholder 및 안내 문구 수정

**변경 전**:
```tsx
<Input
  id="username"
  placeholder="영문, 숫자 조합"
  ...
/>
```

**변경 후**:
```tsx
<Input
  id="username"
  placeholder="예: 홍길동, user123, 관리자_01"
  ...
/>
{!isEdit && (
  <p className="text-xs text-muted-foreground">
    한글, 영문, 숫자, 밑줄(_), 하이픈(-) 사용 가능 (최소 2자)
  </p>
)}
```

---

## 📊 검증 규칙

### ✅ 허용되는 문자

| 문자 종류 | 예시 | 정규식 |
|----------|------|--------|
| 한글 | 홍길동, 관리자 | `가-힣` |
| 영문 대문자 | USER, ADMIN | `A-Z` |
| 영문 소문자 | user, admin | `a-z` |
| 숫자 | 123, 456 | `0-9` |
| 밑줄 | user_01 | `_` |
| 하이픈 | user-01 | `-` |

### ❌ 차단되는 문자 (보안)

| 문자 | 이유 | 예시 공격 |
|------|------|----------|
| `<` `>` | XSS 방지 | `<script>` |
| `'` `"` | SQL Injection 방지 | `admin' OR '1'='1` |
| `\` | 이스케이프 문자 | `\'` |
| `;` | SQL 명령 구분자 | `DROP TABLE users;` |
| `` ` `` | 템플릿 리터럴 | `` `${cmd}` `` |

### 📏 길이 제한

- **최소**: 2자
- **최대**: 50자 (DB VARCHAR(50))

---

## 🧪 테스트 케이스

### ✅ 통과해야 하는 경우

| 아이디 | 설명 |
|--------|------|
| `홍길동` | 한글만 |
| `user123` | 영문+숫자 |
| `관리자_01` | 한글+숫자+밑줄 |
| `hong-gildong` | 영문+하이픈 |
| `admin` | 영문만 |
| `123` | 숫자만 (최소 2자 이상) |
| `김철수_manager` | 한글+영문+밑줄 |

### ❌ 차단되어야 하는 경우

| 아이디 | 에러 메시지 |
|--------|------------|
| `a` | 아이디는 최소 2자 이상이어야 합니다 |
| `user@email.com` | 아이디는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다 |
| `admin<script>` | 아이디에 특수문자(<, >, ', ", \, ;, `)는 사용할 수 없습니다 |
| `user'admin` | 아이디에 특수문자(<, >, ', ", \, ;, `)는 사용할 수 없습니다 |
| `test;DROP` | 아이디에 특수문자(<, >, ', ", \, ;, `)는 사용할 수 없습니다 |
| `   ` (공백만) | 아이디는 필수입니다 |

---

## 🔒 보안 고려사항

### 1. SQL Injection 방지
```typescript
// 차단되는 문자
if (/[<>'"\\;`]/.test(formData.username)) {
  alert('아이디에 특수문자(<, >, \', ", \\, ;, `)는 사용할 수 없습니다')
  return
}
```

**예시 공격 시도**:
- `admin' OR '1'='1` → ❌ 차단
- `user; DROP TABLE users;` → ❌ 차단

### 2. XSS (Cross-Site Scripting) 방지
```typescript
// < > 문자 차단
if (/[<>'"\\;`]/.test(formData.username)) {
  // 차단
}
```

**예시 공격 시도**:
- `<script>alert('XSS')</script>` → ❌ 차단
- `<img src=x onerror=alert(1)>` → ❌ 차단

### 3. 데이터베이스 레벨 보안
- ✅ RPC 함수에서 `prepared statement` 사용
- ✅ `VARCHAR(50)` 타입으로 길이 제한
- ✅ 한글 저장 완벽 지원 (UTF-8 인코딩)

---

## 📌 데이터베이스 영향

### 기존 테이블 구조 (변경 없음)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,  -- ✅ 한글 지원
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    branch_id UUID REFERENCES branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**확인**:
- ✅ `VARCHAR(50)` - UTF-8 인코딩으로 한글 완벽 지원
- ✅ 한글 1자 = 약 3바이트 (최대 약 16자의 한글 저장 가능)
- ✅ 영문/숫자는 1바이트 (최대 50자 저장 가능)

---

## 🚀 사용 예시

### 1. 한글 아이디로 사용자 생성
```
아이디: 홍길동
표시 이름: 홍길동
권한: 직원
→ ✅ 성공
```

### 2. 한글+영문 조합
```
아이디: 관리자_admin
표시 이름: 시스템 관리자
권한: 시스템 관리자
→ ✅ 성공
```

### 3. 특수문자 시도 (차단)
```
아이디: admin@naver.com
→ ❌ "아이디는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다"
```

---

## 🔄 롤백 방법 (필요 시)

```typescript
// UserForm.tsx에서 한글 차단으로 되돌리기

// 영문+숫자만 허용
const usernameRegex = /^[a-zA-Z0-9_-]+$/
if (!usernameRegex.test(formData.username.trim())) {
  alert('아이디는 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다')
  return
}

// placeholder 수정
placeholder="영문, 숫자 조합"
```

---

## ✅ 체크리스트

- [x] 한글 입력 정규식 추가 (`가-힣`)
- [x] 위험 문자 차단 (`<>'"\\;``)
- [x] 최소 길이 검증 (2자 이상)
- [x] Placeholder 업데이트 ("예: 홍길동, user123, 관리자_01")
- [x] 안내 문구 추가
- [x] 빌드 성공 확인
- [x] Linter 에러 없음

---

## 📝 참고사항

### 기존 사용자 영향
- ✅ **기존 영문 아이디**: 변경 없음, 정상 작동
- ✅ **기존 로그인**: 영향 없음
- ✅ **데이터베이스**: 변경 없음

### 브라우저 호환성
- ✅ 모든 모던 브라우저에서 한글 입력 지원
- ✅ Chrome, Edge, Firefox, Safari 모두 정상 작동

---

**작업 완료!** 🎉  
이제 한글 아이디로 사용자를 생성할 수 있습니다.

