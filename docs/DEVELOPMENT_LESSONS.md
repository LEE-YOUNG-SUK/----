# 개발 중 학습한 교훈 및 베스트 프랙티스

> **작성일**: 2025년 1월  
> **프로젝트**: drevers-erp-next (Next.js 15 + Supabase)

---

## 📋 목차
1. [데이터베이스 설계 원칙](#1-데이터베이스-설계-원칙)
2. [Supabase RPC 함수 작성 규칙](#2-supabase-rpc-함수-작성-규칙)
3. [Next.js 아키텍처 패턴](#3-nextjs-아키텍처-패턴)
4. [타입 안정성 보장](#4-타입-안정성-보장)
5. [권한 시스템 구현](#5-권한-시스템-구현)
6. [디버깅 전략](#6-디버깅-전략)

---

## 1. 데이터베이스 설계 원칙

### ✅ UUID 타입 필수 사용
**문제**: 초기에 RPC 함수에서 TEXT 타입으로 ID를 반환했더니 런타임 에러 발생  
**해결**: 모든 ID 컬럼은 **UUID 타입으로 통일**

```sql
-- ❌ 잘못된 예
CREATE FUNCTION get_data()
RETURNS TABLE (
  id TEXT,              -- 에러 발생!
  branch_id TEXT,
  client_id TEXT
)

-- ✅ 올바른 예
CREATE FUNCTION get_data()
RETURNS TABLE (
  id UUID,              -- UUID 타입 필수
  branch_id UUID,
  client_id UUID,
  created_by UUID
)
```

### ✅ RPC 함수 오버로딩 금지
**문제**: 같은 이름의 함수가 여러 개 존재하면 "Could not choose best candidate function" 에러  
**해결**: 함수 수정 전 **반드시 기존 버전 삭제**

```sql
-- 함수 수정 시 항상 먼저 삭제
DROP FUNCTION IF EXISTS public.get_purchases_list(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_sales_list(TEXT, DATE, DATE);

-- 그 다음 새로 생성
CREATE FUNCTION public.get_purchases_list(...)
```

### ✅ WHERE 절 타입 캐스팅
**문제**: TEXT 파라미터로 UUID 컬럼을 직접 비교하면 타입 에러  
**해결**: UUID → TEXT 캐스팅 사용

```sql
-- ❌ 잘못된 예
WHERE p_branch_id IS NULL OR branch_id = p_branch_id  -- 타입 불일치

-- ✅ 올바른 예
WHERE p_branch_id IS NULL OR branch_id::TEXT = p_branch_id
```

### ✅ RLS(Row Level Security) 관리
**결정**: 이 프로젝트는 **RLS를 비활성화**하고 애플리케이션 레벨에서 권한 관리
- 이유: 복잡한 역할 기반 권한(4단계)을 앱에서 직접 제어하는 게 더 명확
- 모든 RPC 함수는 `SECURITY DEFINER`로 설정하여 RLS 우회

```sql
-- 모든 테이블 RLS 비활성화
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
```

---

## 2. Supabase RPC 함수 작성 규칙

### ✅ RPC 함수 템플릿

```sql
-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS public.function_name(param_types);

-- 2. 함수 생성
CREATE FUNCTION public.function_name(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,                    -- 모든 ID는 UUID
  branch_id UUID,
  client_id UUID,
  product_id UUID,
  name TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER              -- RLS 우회
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.branch_id,
    t.client_id,
    t.product_id,
    COALESCE(t.name, '')::TEXT AS name,  -- NULL 방지
    COALESCE(t.amount, 0) AS amount,
    t.created_at,
    t.created_by
  FROM public.table_name t
  LEFT JOIN public.other_table o ON t.other_id = o.id
  WHERE 
    (p_branch_id IS NULL OR t.branch_id::TEXT = p_branch_id)
    AND (p_start_date IS NULL OR t.date >= p_start_date)
    AND (p_end_date IS NULL OR t.date <= p_end_date)
  ORDER BY t.created_at DESC;
END;
$$;

-- 3. 권한 부여
GRANT EXECUTE ON FUNCTION public.function_name(...) TO authenticated;
GRANT EXECUTE ON FUNCTION public.function_name(...) TO anon;
```

### ✅ RPC 함수 네이밍 규칙
- 조회: `get_{domain}_list`, `get_{domain}_by_id`
- 생성/수정: `process_{action}_with_{logic}` (예: `process_sale_with_fifo`)
- 복잡한 로직: `update_{domain}_{action}` (예: `update_inventory_layers`)

---

## 3. Next.js 아키텍처 패턴

### ✅ Server Component + Server Actions 패턴

```typescript
// app/domain/page.tsx (Server Component)
import { getDataList } from './actions'

export default async function Page() {
  // 서버에서 직접 데이터 fetch
  const data = await getDataList()
  
  return <ClientComponent data={data} />
}
```

```typescript
// app/domain/actions.ts (Server Actions)
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getDataList() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_data_list')
  
  if (error) throw error
  return data
}

export async function saveData(formData: FormData) {
  const supabase = await createClient()
  
  // RPC 호출
  const { data, error } = await supabase.rpc('process_data', {
    p_param1: formData.get('param1'),
    p_param2: formData.get('param2')
  })
  
  if (error) throw error
  
  // ⚠️ 중요: 캐시 무효화 필수!
  revalidatePath('/domain')
  
  return { success: true, data }
}
```

### ✅ 세션 검증 패턴

```typescript
// app/domain/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value
  
  if (!token) redirect('/login')
  
  const supabase = await createClient()
  const { data: sessionData } = await supabase.rpc('verify_session', {
    p_token: token
  })
  
  if (!sessionData?.[0]?.valid) redirect('/login')
  
  const userSession = {
    user_id: sessionData[0].user_id,
    username: sessionData[0].username,
    role: sessionData[0].role,
    branch_id: sessionData[0].branch_id
  }
  
  // 권한 체크
  const checker = new PermissionChecker(userSession.role)
  if (!checker.can('resource_name', 'read')) {
    redirect('/unauthorized')
  }
  
  // 정상 처리
  return <YourComponent user={userSession} />
}
```

### ✅ 데이터 흐름 순서
1. **미들웨어** (`middleware.ts`): 세션 토큰 존재 여부만 체크
2. **페이지** (`app/*/page.tsx`): RPC로 세션 검증 + 권한 체크
3. **Server Actions** (`app/*/actions.ts`): 데이터 변경 + `revalidatePath()`
4. **클라이언트 컴포넌트**: UI 렌더링 + 이벤트 핸들링

---

## 4. 타입 안정성 보장

### ✅ RPC 응답 필드명 ≠ 앱 타입 필드명 문제

**문제**: RPC 함수가 `client_name`을 반환하는데 앱은 `customer_name` 사용  
**해결**: Server Actions에서 **필드 매핑 레이어** 추가

```typescript
// types/sales.ts
export interface SaleHistory {
  id: string
  customer_name: string     // 앱에서 사용하는 필드명
  total_amount: number
  cost_of_goods: number
  profit: number
  profit_margin: number
}
```

```typescript
// app/sales/actions.ts
export async function getSalesHistory() {
  const { data } = await supabase.rpc('get_sales_list')
  
  // ✅ 필드명 매핑
  return data.map(item => ({
    id: item.id,
    customer_name: item.client_name || '',        // DB → App
    total_amount: item.total_price || 0,          // DB → App
    cost_of_goods: item.cost_of_goods_sold || 0,  // DB → App
    profit: item.profit || 0,
    profit_margin: item.total_price > 0 
      ? ((item.profit || 0) / item.total_price) * 100 
      : 0
  }))
}
```

### ✅ Supabase 타입 자동 생성

```bash
# 원격 DB 스키마를 로컬로 동기화
supabase db pull

# TypeScript 타입 생성
supabase gen types typescript --local > types/supabase.ts
```

---

## 5. 권한 시스템 구현

### ✅ 4단계 역할 시스템
- `0000`: 시스템 관리자 (모든 권한)
- `0001`: 원장 (지점 내 모든 데이터 관리)
- `0002`: 매니저 (자기 지점 데이터 관리)
- `0003`: 사용자 (읽기 전용)

### ✅ 권한 체크 패턴

```typescript
// lib/permissions.ts
export class PermissionChecker {
  constructor(private role: string) {}
  
  can(resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[this.role]
    if (!permissions) return false
    return permissions[resource]?.[action] || false
  }
}
```

```typescript
// Server Component에서
const checker = new PermissionChecker(user.role)
if (!checker.can('purchases_management', 'create')) {
  throw new Error('권한이 없습니다')
}
```

```typescript
// Client Component에서
import { usePermissions } from '@/hooks/usePermissions'

function MyComponent({ userRole }) {
  const { can } = usePermissions(userRole)
  
  return (
    <>
      {can('sales_management', 'create') && (
        <CreateButton />
      )}
    </>
  )
}
```

```tsx
// UI 조건부 렌더링
import { ProtectedAction } from '@/components/shared/ProtectedAction'

<ProtectedAction role={role} resource="products_management" action="update">
  <EditButton />
</ProtectedAction>
```

### ✅ 새 권한 추가 시 체크리스트
1. `types/permissions.ts` - `ResourceType`, `ActionType` 추가
2. `types/permissions.ts` - `ROLE_PERMISSIONS` 맵 업데이트
3. `lib/permissions.ts` - 필요 시 특수 로직 추가
4. `components/shared/Navigation.tsx` - 메뉴 항목에 권한 체크 추가

---

## 6. 디버깅 전략

### ✅ 체계적 디버깅 순서

1. **테이블 스키마 확인**
```sql
-- 테이블 컬럼 타입 확인
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('purchases', 'sales')
ORDER BY table_name, ordinal_position;
```

2. **RPC 함수 시그니처 확인**
```sql
-- 함수 정의 확인
SELECT 
  routine_name,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'get_%'
ORDER BY routine_name;
```

3. **데이터 존재 여부 확인**
```sql
-- 실제 데이터 건수 확인
SELECT 'purchases' as table_name, COUNT(*) as count FROM purchases
UNION ALL
SELECT 'sales', COUNT(*) FROM sales;
```

4. **RPC 함수 직접 테스트**
```sql
-- Supabase SQL Editor에서 직접 실행
SELECT * FROM get_purchases_list(NULL, NULL, NULL) LIMIT 5;
SELECT * FROM get_sales_list(NULL, NULL, NULL) LIMIT 5;
```

### ✅ 디버깅 SQL 파일 작성
문제 발생 시 **단계별 검증 SQL 파일**을 작성하면 효율적

```sql
-- database/diagnose_issue.sql
-- Step 1: 테이블 존재 확인
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'your_table';

-- Step 2: 컬럼 타입 확인
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'your_table';

-- Step 3: 데이터 샘플 확인
SELECT * FROM your_table LIMIT 5;

-- Step 4: RPC 함수 테스트
SELECT * FROM get_your_data() LIMIT 5;
```

---

## 📝 새 도메인 추가 시 체크리스트

### 1. 데이터베이스 레이어
- [ ] `database/{domain}_table.sql` - 테이블 스키마 (UUID 타입 필수)
- [ ] `database/{domain}_rpc_functions.sql` - RPC 함수 (UUID 반환)
- [ ] Supabase에서 SQL 실행 후 타입 재생성: `supabase gen types typescript --local > types/supabase.ts`

### 2. 타입 정의
- [ ] `types/{domain}.ts` - 도메인 타입 정의
- [ ] `types/permissions.ts` - 권한 리소스 추가

### 3. 백엔드 로직
- [ ] `app/{domain}/actions.ts` - Server Actions
  - [ ] `'use server'` 선언 필수
  - [ ] RPC 호출 후 `revalidatePath()` 필수
  - [ ] 필드명 매핑 로직 (RPC ≠ 앱 타입인 경우)

### 4. 프론트엔드
- [ ] `app/{domain}/page.tsx` - Server Component
  - [ ] 세션 검증
  - [ ] 권한 체크
- [ ] `components/{domain}/` - 클라이언트 컴포넌트
  - [ ] `'use client'` 선언
  - [ ] Server Actions 호출

### 5. UI/UX
- [ ] `components/shared/Navigation.tsx` - 메뉴 추가 (권한 체크 포함)
- [ ] `components/{domain}/{Domain}Form.tsx` - 폼 컴포넌트
- [ ] `components/{domain}/{Domain}Table.tsx` - 테이블 컴포넌트

---

## 🚀 다음 프로젝트 시작 시 프롬프트

```
Next.js 15 App Router + Supabase 프로젝트를 시작합니다.

핵심 아키텍처 원칙:
1. 데이터베이스: 모든 ID 컬럼은 UUID 타입, RPC 함수도 UUID 반환 필수
2. RPC 함수: SECURITY DEFINER 설정, 오버로딩 금지 (수정 시 DROP 먼저)
3. Next.js: Server Components + Server Actions 패턴, revalidatePath() 필수
4. 타입: RPC 응답과 앱 타입이 다르면 Server Actions에서 매핑 레이어 추가
5. 권한: 4단계 역할 시스템, PermissionChecker로 서버/클라이언트 모두 체크
6. 세션: 쿠키 기반 토큰 → RPC verify_session 검증 → 권한 체크 → 페이지 렌더링

참고 문서:
- .github/copilot-instructions.md (프로젝트 전체 구조)
- docs/DEVELOPMENT_LESSONS.md (개발 중 학습한 교훈)
- database/complete_schema.sql (전체 DB 스키마)

이 원칙들을 준수하면서 [구현할 기능]을 개발해주세요.
```

---

## 🔍 참고 파일 (학습용)

### 패턴별 참고 파일
- **세션/권한**: `middleware.ts`, `lib/permissions.ts`, `hooks/usePermissions.ts`
- **Server Actions**: `app/purchases/actions.ts`, `app/sales/actions.ts`
- **RPC 함수**: `database/uuid_rpc_functions.sql`, `database/clients_rpc_functions.sql`
- **페이지 구조**: `app/purchases/page.tsx`, `app/sales/page.tsx`
- **그리드 컴포넌트**: `components/purchases/PurchaseGrid.tsx` (AG Grid + 자동완성)
- **FIFO 로직**: `types/inventory.ts`, `components/Inventory/InventoryLayerModal.tsx`

---

## ⚡ 자주 발생하는 에러와 해결법

### 1. "Could not choose best candidate function"
- **원인**: 같은 이름의 RPC 함수 중복
- **해결**: `DROP FUNCTION IF EXISTS` 후 재생성

### 2. "column is of type uuid but expression is of type text"
- **원인**: RPC 함수가 TEXT 반환했는데 DB는 UUID
- **해결**: `RETURNS TABLE (id UUID, ...)` 수정

### 3. "Cannot read property 'toLocaleString' of undefined"
- **원인**: RPC 필드명과 앱 타입 필드명 불일치
- **해결**: Server Actions에서 필드 매핑 추가

### 4. "UI가 업데이트 안됨"
- **원인**: Server Actions에서 `revalidatePath()` 누락
- **해결**: 데이터 변경 후 항상 `revalidatePath('/path')` 호출

### 5. "권한 없는데 버튼이 보임"
- **원인**: UI 권한 체크 누락
- **해결**: `<ProtectedAction>` 또는 `can()` 조건 추가

---

**작성자**: GitHub Copilot AI Assistant  
**업데이트**: 2025년 1월 (UUID 타입 이슈 해결 완료)
