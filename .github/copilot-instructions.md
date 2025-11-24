# Copilot Instructions for drevers-erp-next

## 프로젝트 개요
Next.js 16 App Router 기반 ERP 시스템. 입고/판매/재고를 **FIFO(선입선출)** 원가 계층으로 관리하며, 역할 기반 권한 시스템(4단계)과 Supabase RPC 중심 아키텍처를 사용합니다.

**핵심 도메인**: 사용자(`users`), 지점(`branches`), 거래처(`clients`), 품목(`products`), 입고(`purchases`), 판매(`sales`), 재고(`inventory`)

## 아키텍처 핵심

### 1. 권한 시스템 (필수 이해)
4단계 역할: `0000`(시스템 관리자), `0001`(원장), `0002`(매니저), `0003`(사용자)

**권한 체크 패턴**:
```typescript
// 서버: lib/permissions.ts의 PermissionChecker 사용
const checker = new PermissionChecker(user.role)
if (!checker.can('purchases_management', 'create')) { ... }

// 클라이언트: hooks/usePermissions.ts
const { can, isSystemAdmin } = usePermissions(user.role)
{can('sales_management', 'read') && <SalesLink />}

// UI 조건부 렌더링: components/shared/ProtectedAction.tsx
<ProtectedAction role={role} resource="products_management" action="update">
  <EditButton />
</ProtectedAction>
```

**권한 정의 위치**: `types/permissions.ts`의 `ROLE_PERMISSIONS` 맵 - 새 권한 추가 시 반드시 여기서 시작

### 2. 세션/인증 흐름
- **미들웨어** (`middleware.ts`): `erp_session_token` 쿠키 확인, 로그인 여부만 체크
- **페이지 레벨** (`app/*/page.tsx`): Supabase RPC `verify_session(p_token)` 호출로 세션 검증 및 사용자 정보 로드
  ```typescript
  const { data: sessionData } = await supabase.rpc('verify_session', { p_token: token })
  if (!sessionData?.[0]?.valid) redirect('/login')
  const userSession = { user_id, username, role, branch_id, ... }
  ```
- **로그인/로그아웃**: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`에서 세션 토큰 관리

### 3. 데이터 흐름 패턴
**Server Actions** (`app/*/actions.ts`): 모든 데이터 변경은 `'use server'` 함수로 처리
- Supabase RPC 함수 호출 (예: `process_sale_with_fifo`, `get_purchases_list`)
- 성공 시 `revalidatePath('/path')`로 캐시 무효화 (예: `revalidatePath('/inventory')`)
- 예시: `app/purchases/actions.ts`의 `savePurchases()`

**Server Components**: 페이지에서 직접 데이터 fetch → props로 클라이언트 컴포넌트에 전달
```typescript
// app/purchases/page.tsx
const [productsResult, suppliersResult] = await Promise.all([
  getProductsList(), getSuppliersList()
])
return <PurchaseForm products={products} suppliers={suppliers} />
```

### 4. FIFO 재고 관리 (독특한 로직)
- **입고**: `purchases` 테이블 기록 → Supabase RPC `update_inventory_layers` 호출 → `inventory_layers`에 신규 레이어 추가
- **판매**: `sales` 테이블 기록 → RPC `process_sale_with_fifo` 호출 → 오래된 레이어부터 차감, 원가 자동 계산
- **재고 조회**: `inventory_layers` 테이블에서 `remaining_quantity > 0`인 레이어만 조회
- 관련 파일: `types/inventory.ts`, `components/Inventory/InventoryLayerModal.tsx`

### 5. 데이터베이스 (Supabase)
- **RLS 비활성화**: 모든 테이블 RLS 해제 (`database/disable_all_rls.sql`) - 앱 레벨 권한 관리
- **RPC 함수 중심**: CRUD는 대부분 Supabase RPC 함수 경유 (예: `get_clients_list`, `process_sale_with_fifo`)
- **스키마 동기화**: 
  - `supabase/migrations/` - DB 마이그레이션 파일 (스키마 변경 이력)
  - `types/supabase.ts` - 자동 생성된 데이터베이스 타입 정의
  - `database/*.sql` - 수동 관리 스키마/RPC 함수 스크립트
- **초기 설정 순서** (`database/README.md` 참고):
  1. `sessions_table.sql` → 2. `users_setup.sql` → 3. `clients_table.sql` → 4. `products_table.sql` → 5. `disable_all_rls.sql`

**스키마 업데이트 시 워크플로우**:
```bash
supabase db pull                    # 원격 DB 스키마를 로컬로 가져오기
supabase gen types typescript --local > types/supabase.ts  # 타입 재생성
```

## 개발 워크플로우

### 실행 명령어
```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사
```

### Supabase 데이터베이스 연동 (Copilot 참조용)
```bash
# 1. Supabase 프로젝트 초기화
supabase init

# 2. 원격 프로젝트와 연결
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 3. DB 스키마를 로컬로 동기화 (Copilot이 참조할 수 있도록)
supabase db pull

# 4. TypeScript 타입 생성
supabase gen types typescript --project-id YOUR_PROJECT_REF > types/supabase.ts

# 5. DB 변경 후 스키마 재동기화
supabase db pull
supabase gen types typescript --local > types/supabase.ts
```

**Copilot이 DB 스키마를 이해하는 방법**:
- `database/complete_schema.sql` - 전체 DB 스키마 통합 파일 (테이블, RPC, 트리거, 인덱스)
- `database/*.sql` - 도메인별 스키마 파일 (개별 테이블, RPC 함수)
- `types/*.ts` - TypeScript 타입 정의 (도메인별 인터페이스)

### 새 도메인 추가 시 체크리스트
1. `types/your-domain.ts` - 타입 정의
2. `app/your-domain/page.tsx` - 서버 컴포넌트 페이지, 세션 검증
3. `app/your-domain/actions.ts` - Server Actions (`'use server'`)
4. `components/your-domain/` - 클라이언트 컴포넌트 (폼, 그리드 등)
5. `types/permissions.ts` - 권한 리소스 추가, `ROLE_PERMISSIONS` 업데이트
6. `components/shared/Navigation.tsx` - 메뉴 항목 추가 (권한 체크 포함)
7. `database/your-domain_table.sql`, `database/your-domain_rpc_functions.sql` - DB 스키마, RPC 함수

### 코드 스타일
- **컴포넌트**: PascalCase, 도메인별 폴더 구분 (예: `components/purchases/PurchaseForm.tsx`)
- **Server Actions**: camelCase 함수명, `'use server'` 필수
- **타입**: 인터페이스 우선, 도메인별 파일 분리 (`types/purchases.ts`, `types/sales.ts`)
- **스타일**: Tailwind CSS 유틸리티 클래스, `globals.css`는 최소화

## 주요 의존성
- **UI**: AG Grid (`ag-grid-react`) - 입고/판매 그리드, 자동완성 에디터 (`ProductCellEditor`)
- **DB**: `@supabase/supabase-js` - RPC 패턴, `lib/supabase/client.ts`, `lib/supabase/server.ts`
- **숫자**: `decimal.js` - 재고/원가 정밀 계산

## 참고 파일 (패턴 학습용)
- **권한**: `lib/permissions.ts`, `hooks/usePermissions.ts`, `components/shared/ProtectedAction.tsx`
- **세션/페이지**: `middleware.ts`, `app/purchases/page.tsx` (표준 패턴)
- **Server Actions**: `app/purchases/actions.ts` (검증 → RPC 호출 → revalidatePath)
- **FIFO 로직**: `app/sales/actions.ts`의 `saveSales()`, `types/inventory.ts`
- **그리드 컴포넌트**: `components/purchases/PurchaseGrid.tsx` (AG Grid + 자동완성)

## 주의사항
- Server Actions에서 `revalidatePath()` 누락하면 UI 업데이트 안됨
- 권한 추가 시 `types/permissions.ts` → `lib/permissions.ts` → UI 순서로 동기화 필수
- Supabase RPC 함수 변경 시 `database/*.sql` 스크립트 먼저 업데이트 후 배포

## 데이터베이스 문제 해결 가이드

### UUID 타입 필수 준수
- **테이블**: 모든 ID 컬럼은 UUID 타입 (`id`, `branch_id`, `client_id`, `product_id`, `created_by`)
- **RPC 함수**: `RETURNS TABLE`에서 UUID 타입으로 반환 필수
  ```sql
  -- ✅ 올바른 예
  RETURNS TABLE (id UUID, branch_id UUID, client_id UUID, ...)
  
  -- ❌ 잘못된 예 (TEXT 반환하면 런타임 에러)
  RETURNS TABLE (id TEXT, branch_id TEXT, ...)
  ```
- **WHERE 절**: TEXT 파라미터로 UUID 컬럼 비교 시 캐스팅 필수
  ```sql
  WHERE p_branch_id IS NULL OR branch_id::TEXT = p_branch_id
  ```

### RPC 함수 오버로딩 주의
- 같은 이름, 같은 파라미터 타입의 함수가 여러 개 존재하면 "Could not choose best candidate" 에러
- 함수 수정 전 반드시 기존 버전 삭제: `DROP FUNCTION IF EXISTS`

### 필드명 매핑
- RPC 함수 반환 필드명 ≠ TypeScript 타입 필드명인 경우
- Server Actions에서 변환 로직 추가 (예: `app/sales/actions.ts`의 `getSalesHistory()`)
  ```typescript
  customer_name: item.client_name,  // DB: client_name → App: customer_name
  total_amount: item.total_price,   // DB: total_price → App: total_amount
  ```

### 참고: UUID 타입 도입 배경
- 2025년 1월 디버깅: 입고/판매 데이터 로딩 실패 → RPC 함수가 TEXT 반환했으나 DB는 UUID
- 해결: `database/uuid_rpc_functions.sql` 생성 (UUID 반환 버전)
- 검증: `database/simple_check.sql`로 테이블 타입 확인

## Supabase 클라이언트 패턴

### 클라이언트 vs 서버 사용법
- **서버 컴포넌트/Server Actions**: `lib/supabase/server.ts`의 `createServerClient()` 사용
  ```typescript
  import { createServerClient } from '@/lib/supabase/server'
  const supabase = await createServerClient()
  ```
- **클라이언트 컴포넌트**: `lib/supabase/client.ts`의 `supabase` export 사용
  ```typescript
  import { supabase } from '@/lib/supabase/client'
  ```

### RPC 호출 패턴
```typescript
// 단일 레코드 조회
const { data, error } = await supabase.rpc('verify_session', { p_token: token })
if (data?.[0]?.valid) { ... }

// 리스트 조회 (필터 파라미터)
const { data, error } = await supabase.rpc('get_purchases_list', {
  p_branch_id: branchId || null,
  p_start_date: startDate,
  p_end_date: endDate
})

// FIFO 처리 (트랜잭션 포함)
const { data, error } = await supabase.rpc('process_sale_with_fifo', {
  p_branch_id, p_client_id, p_product_id, p_quantity, p_unit_price, ...
})
```
