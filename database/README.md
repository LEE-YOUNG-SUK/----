# Database 스크립트 가이드

이 폴더에는 Supabase 데이터베이스 설정을 위한 SQL 스크립트가 포함되어 있습니다.

## 📋 파일 목록 및 용도

### 1️⃣ 필수 스크립트 (초기 설정 시 실행 순서)

#### **1. sessions_table.sql**
- 세션 관리 테이블 생성
- 사용자 로그인/로그아웃 세션 저장
- `verify_session` RPC 함수 포함

#### **2. users_setup.sql**
- 사용자 및 지점 테이블 생성
- 사용자 관리에 필요한 기본 스키마
- 트리거 및 인덱스 설정

#### **3. clients_table.sql**
- 거래처(공급업체/고객) 테이블 생성
- 거래처 관리 기본 스키마
- 샘플 데이터 포함

#### **4. products_table.sql**
- 품목 테이블 생성
- 품목 관리 기본 스키마
- 샘플 데이터 포함

#### **5. disable_all_rls.sql** ⭐ **중요**
- 모든 테이블의 RLS(Row Level Security) 비활성화
- 애플리케이션 레벨에서 권한 관리를 위해 필수
- **다른 스크립트 실행 후 마지막에 실행**

### 2️⃣ RPC 함수 스크립트

#### **6. clients_rpc_functions.sql**
- `get_clients_list()` - 거래처 전체 조회
- `get_suppliers_list()` - 공급업체 조회
- `get_customers_list()` - 고객 조회

#### **7. products_rpc_functions.sql**
- `get_products_list()` - 품목 전체 조회

#### **8. users_rpc_functions.sql**
- `get_all_users()` - 사용자 전체 조회

#### **9. purchases_sales_rpc_functions.sql**
- `get_purchases_list()` - 입고 내역 조회 (지점, 기간 필터)
- `get_sales_list()` - 판매 내역 조회 (지점, 기간 필터)

---

## 🚀 초기 설정 가이드

### Supabase SQL Editor에서 순서대로 실행:

```sql
-- 1. 세션 테이블
sessions_table.sql

-- 2. 사용자 및 지점 테이블
users_setup.sql

-- 3. 거래처 테이블
clients_table.sql

-- 4. 품목 테이블
products_table.sql

-- 5. RPC 함수들
clients_rpc_functions.sql
products_rpc_functions.sql
users_rpc_functions.sql
purchases_sales_rpc_functions.sql

-- 6. RLS 비활성화 (마지막에 실행!)
disable_all_rls.sql
```

---

## 🔐 권한 관리 방식

이 프로젝트는 **데이터베이스 RLS 대신 애플리케이션 레벨에서 권한을 관리**합니다.

- **페이지 레벨**: `PermissionChecker` (lib/permissions.ts)
- **UI 컴포넌트**: `usePermissions` 훅 (hooks/usePermissions.ts)
- **서버 액션**: 세션 토큰 검증 + 권한 확인

### 이유:
- ✅ 더 명확한 권한 로직
- ✅ 디버깅 용이
- ✅ TypeScript 타입 안정성
- ✅ 재귀 참조 문제 없음

---

## 📝 참고 사항

- 모든 테이블은 `IF NOT EXISTS` 조건으로 안전하게 생성
- 기존 데이터는 `ON CONFLICT DO NOTHING`으로 보호
- RPC 함수는 `SECURITY DEFINER`로 RLS 우회
