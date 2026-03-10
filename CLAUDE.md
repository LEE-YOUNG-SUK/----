# DR.Evers ERP 시스템

## 프로젝트 개요
피부과 네트워크(DR.Evers)의 다중 지점 재고/매입/매출 관리 ERP 시스템.
본사(동안기획)와 각 지점 간의 품목, 거래처, 입출고, 재고를 통합 관리한다.

## 기술 스택
- **프레임워크**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **스타일링**: Tailwind CSS 4
- **DB**: Supabase PostgreSQL (프로젝트 ID: `tvkoqazcymrygqpxgyym`, 서울 리전)
- **테이블 그리드**: AG Grid Community + TanStack React Table
- **토스트**: Sonner
- **인증**: 커스텀 쿠키 기반 세션 (`erp_session_token`)
- **배포**: Vercel

## 명령어
- `npm run dev` - 개발 서버
- `npm run build` - 프로덕션 빌드
- `npm run lint` - ESLint 실행

---

## 디렉토리 구조

```
app/                          # Next.js App Router 페이지
├── login/                    # 로그인
├── products/                 # 품목 관리
├── clients/                  # 거래처 관리
├── purchases/                # 입고 (입력 + 조회)
├── sales/                    # 판매 (입력 + 조회)
├── inventory/                # 재고현황 + 재고수불부
├── inventory-adjustments/    # 재고조정
├── b2b-orders/               # B2B 발주 (지점: 발주하기/내역/상세)
│   └── admin/                # B2B 주문관리 (본사: 전체주문/상세/세금계산서)
├── reports/                  # 레포트 (종합/구매/판매/만족도/B2B정산)
├── admin/                    # 관리자 (지점/사용자/카테고리/감사로그/데이터가져오기)
└── api/auth/                 # 로그인/로그아웃 API

components/
├── ui/                       # 기본 UI 컴포넌트 (Button, Dialog, Card, Table 등)
├── shared/                   # 공통 컴포넌트 (Navigation, PageLayout, FormField 등)
├── products/                 # 품목 관련
├── purchases/                # 입고 관련
├── sales/                    # 판매 관련
├── Inventory/                # 재고 관련
├── inventory-adjustments/    # 재고조정 관련
├── clients/                  # 거래처 관련
├── admin/                    # 관리자 관련
├── reports/                  # 레포트 관련
├── b2b-orders/               # B2B 발주 컴포넌트
└── import/                   # CSV 가져오기

lib/
├── supabase/server.ts        # 서버용 Supabase 클라이언트 (service_role, RLS 우회)
├── supabase/client.ts        # 클라이언트용 Supabase (anon key)
├── session.ts                # 세션 검증 (requireSession, requirePermission)
├── permissions.ts            # RBAC 권한 체커
├── error-handler.ts          # 안전한 에러 처리 유틸
├── date-utils.ts             # 날짜 포맷 유틸
└── audit-field-labels.ts     # 감사 로그 필드명 매핑

types/
├── index.ts                  # 공통 타입 (User, UserData, Branch, Client, Product 등)
├── database.ts               # DB 테이블 타입
├── permissions.ts            # RBAC 역할/권한 정의
├── purchases.ts / sales.ts   # 거래 타입
├── inventory.ts              # 재고 타입
├── inventory-adjustment.ts   # 재고조정 타입
├── reports.ts                # 레포트 타입
├── audit.ts                  # 감사 로그 타입
├── survey.ts                 # 만족도 조사 타입
└── b2b.ts                    # B2B 발주 타입 (상태, 주문, 출고, 명세서, 정산 등)

hooks/
├── usePermissions.ts         # 클라이언트 권한 체크
├── useMediaQuery.ts          # 반응형 브레이크포인트
└── useConfirm.tsx            # 확인 다이얼로그 훅
```

---

## 아키텍처 패턴

### 데이터 흐름
```
Server Component (page.tsx)
  → requireSession() / requirePermission()
  → NavigationWrapper (Client)
    → PageLayout
      → Feature Components (Client)
        → Server Actions ('use server')
          → Supabase RPC (PostgreSQL 함수)
            → Database
```

### 서버 액션 패턴
각 기능 모듈은 `app/[feature]/actions.ts`에 서버 액션을 정의한다.
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/session'

export async function getData() {
  const session = await requireSession()
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('rpc_function_name', { ... })
  if (error) throw error
  return data
}
```

### 인증/권한 체계
- **미들웨어** (`middleware.ts`): `erp_session_token` 쿠키 존재 여부만 체크
- **서버 컴포넌트**: `requireSession()` → Supabase `verify_session` RPC로 실제 검증
- **권한 체크**: `requirePermission(resource, action)` → RBAC 기반 접근 제어
- **클라이언트**: `usePermissions()` 훅으로 UI 요소 조건부 렌더링

### 역할 체계 (4단계)
| 코드 | 역할 | 범위 |
|------|------|------|
| `0000` | 시스템 관리자 | 모든 지점, 모든 권한 |
| `0001` | 원장 | 본인 지점, 전체 CRUD + 사용자 관리 |
| `0002` | 매니저 | 본인 지점, CRUD (재고조정 생성만) |
| `0003` | 사용자 | 본인 지점, 조회 + 생성 + 수정 (삭제 불가) |

---

## DB 핵심 규칙

### 컬럼 네이밍 (절대 규칙)
- **DB 컬럼명 = TypeScript 필드명 = RPC 반환값** → 반드시 1:1 일치
- 같은 의미의 컬럼을 다른 이름으로 만들지 말 것 (예: total_cost + total_price 금지)
- 코드에서 DB 컬럼명과 다른 alias 사용 금지

### 확정된 네이밍
| 의미 | 컬럼명 | 비고 |
|------|--------|------|
| 입고 단가 | `unit_cost` | purchases |
| 판매 단가 | `unit_price` | sales |
| 공급가 | `supply_price` | purchases, sales |
| 부가세 | `tax_amount` | purchases, sales |
| 합계 | `total_price` | purchases, sales |
| 합계(재고조정) | `total_cost` | inventory_adjustments만 |
| FIFO 원가 | `cost_of_goods_sold` | sales |
| 생성자/수정자 | `created_by` / `updated_by` | uuid FK→users(id) |

### 테이블 구조 (ERP 11개)
- `users`, `branches`, `sessions`
- `clients`, `product_categories`, `products`
- `purchases`, `sales`, `inventory_layers` (FIFO)
- `inventory_adjustments`, `audit_logs`

### 주요 특이사항
- `users.display_name` → `name`이 아님!
- `inventory_adjustments`만 `total_cost` 사용 (나머지는 `total_price`)
- `branches`는 ERP + 예약시스템 공통 → 변경 시 양쪽 영향
- RLS 전체 활성화 상태, 서버는 service_role로 우회
- 품목/거래처에 `branch_id` nullable 컬럼 존재 (지점별 관리 구현됨)
  - `NULL` = 공용 (전 지점 공유), `UUID` = 해당 지점 전용

---

## 절대 금지 사항

1. **예약시스템 테이블 5개 절대 건드리지 말 것**
   - `reservation_users`, `reservations`, `reservation_customers`, `reservation_logs`, `notifications`
2. **DB 컬럼명과 다른 alias 매핑 금지** (과거 실수: total_price→total_amount)
3. **환경 변수 하드코딩 금지** (.env 파일의 키 절대 노출하지 말 것)
4. **`components/ui/` 컴포넌트 직접 수정 시 하위 호환성 반드시 유지**
5. **새 패키지 설치 전 반드시 사용자에게 확인**

---

## 코딩 컨벤션

- 한국어 주석 사용
- 변수명/함수명은 영어 camelCase, DB 컬럼/타입은 snake_case
- `async/await` 패턴 사용
- 에러 처리: `getSafeErrorMessage()` 사용 (민감 정보 노출 방지)
- 토스트 알림: `sonner`의 `toast.success()` / `toast.error()` 사용
- UI 컴포넌트: `components/ui/` 기존 컴포넌트 재사용 우선
- 경로 alias: `@/*` → 루트 디렉토리 기준
- 커밋 메시지: 한국어로 작성

---

## B2B 온라인 발주 시스템

### 개요
기존 ERP에 지점↔본사(동안기획) 간 B2B 온라인 발주 기능을 추가하는 프로젝트.
기존 시스템과 완벽히 분리하여 기능 충돌 없이 확장한다.

### 분리 규칙
- 신규 DB 테이블: `b2b_` 접두사 (기존 ERP 테이블 구조/로직 변경 없음)
- 신규 페이지: `app/b2b-orders/` 하위
- 신규 컴포넌트: `components/b2b-orders/` 하위
- 타입: `types/b2b.ts`
- 공통 모듈 재사용하되 수정 시 하위 호환성 유지

### 역할별 B2B 권한
| 기능 | 본사(0000) | 원장(0001) | 매니저(0002, 승인시) | 사용자(0003) |
|------|-----------|-----------|-------------------|------------|
| 발주 생성 | O (지점 대신) | O | O (can_b2b_order) | X |
| 발주 조회 | O (전체) | O (본인 지점) | O (본인 지점) | X |
| 주문 처리(상태변경) | O | X | X | X |
| 출고/배송 관리 | O | X (수령확인만) | X | X |
| 거래명세서 발행 | O | X | X | X |
| 거래명세서 수신/조회 | O | O | O (승인시) | X |
| 세금계산서 발행 | O | X | X | X |
| 세금계산서 수신/조회 | O | O | X | X |
| 정산 처리 | O | X | X | X |
| 정산 조회 | O | O | X | X |
| 미수/정산 리포트 | O | O | X | X |
| 발주가능 품목/단가 설정 | O | X | X | X |
| 매니저 발주권한 승인 | X | O (본인 지점) | X | X |

### DB 스키마 (Phase 1 완료)
기존 테이블 컬럼 추가:
- `users.can_b2b_order` (boolean, default false) - 매니저 발주 권한 플래그
- `products.is_b2b_orderable` (boolean, default false) - B2B 발주 가능 품목
- `products.b2b_price` (numeric(12,2), nullable) - B2B 전용단가

B2B 전용 테이블 (9개):
- `b2b_orders` - 주문 헤더 (상태 10개, 진행률, 승인/취소 이력)
- `b2b_order_items` - 주문 항목 (수량, 단가, 출고/정산 누적)
- `b2b_order_status_history` - 상태 전이 이력
- `b2b_shipments` - 출고/배송 (택배사, 운송장, 수령확인)
- `b2b_shipment_items` - 출고 항목
- `b2b_transaction_statements` - 거래명세서 (JSONB 스냅샷, 재발행)
- `b2b_statement_items` - 거래명세서 항목
- `b2b_settlements` - 정산 (방향: receivable/payable)
- `b2b_tax_invoices` - 세금계산서

### 주문 상태 머신
```
draft → pending_approval → approved → partially_shipped → shipped
                         → on_hold ↔ approved              → partially_settled → settled → completed
                         → canceled (출고 전만)
```

### 단가/부가세 정책
- 단가: `products.b2b_price` (본사가 설정한 B2B 전용단가)
- 부가세: 10% 자동 계산 (supply_price = unit_price × quantity, tax_amount = supply_price × 0.1)

### 권한 리소스 (types/permissions.ts)
- `b2b_orders` - 발주 생성/조회
- `b2b_order_processing` - 주문 처리 (본사)
- `b2b_statements` - 거래명세서
- `b2b_settlements` - 정산
- `b2b_tax_invoices` - 세금계산서

### RPC 함수
Phase 1 (기반 인프라):
- `b2b_generate_order_number(p_branch_id)` - 주문번호 자동생성
- `b2b_can_user_order(p_user_id)` - 발주 권한 검증
- `b2b_toggle_manager_order_permission(...)` - 매니저 발주권한 토글
- `b2b_toggle_product_orderable(...)` - 품목 발주가능 토글
- `b2b_update_product_b2b_price(...)` - B2B 전용단가 설정
- `b2b_get_orderable_products(p_branch_id)` - 발주 가능 품목 목록

Phase 2 (핵심 주문):
- `b2b_create_order(p_user_id, p_branch_id, p_items, p_memo)` - 주문 생성 (권한+품목 검증, 부가세 자동계산)
- `b2b_submit_order(p_user_id, p_order_id)` - 주문 제출 (draft→pending_approval)
- `b2b_cancel_draft_order(p_user_id, p_order_id)` - 임시저장 주문 취소
- `b2b_get_orders_by_branch(p_branch_id, p_status, p_from_date, p_to_date)` - 지점별 주문 목록
- `b2b_get_all_orders(p_status, p_branch_id, p_from_date, p_to_date)` - 전체 주문 목록 (본사용)
- `b2b_get_order_detail(p_order_id)` - 주문 상세 (아이템+상태이력 포함)

### 서버 액션 (Phase 2)
- `app/b2b-orders/actions.ts` - 지점용 (발주 생성/조회/제출/취소)
- `app/b2b-orders/admin/actions.ts` - 본사용 (전체 주문 조회, B2B 설정)

### 컴포넌트 (Phase 2)
- `B2bProductCatalog` - 발주 가능 품목 카탈로그 (검색, 수량 입력)
- `B2bCart` - 장바구니 (수량 수정, 메모, 부가세 자동계산)
- `B2bOrderList` - 주문 목록 테이블 (상태배지, 진행률)
- `B2bOrderDetail` - 주문 상세 (아이템, 상태이력 타임라인)
- `B2bOrderStatusBadge` - 상태별 색상 배지
- `B2bProgressBar` - 출고/정산 진행률 바
- `B2bOrderFilters` - 필터 컨트롤 (상태, 기간, 지점)

### 페이지 (Phase 2)
- `/b2b-orders` - 지점 발주 내역
- `/b2b-orders/new` - 새 발주 (카탈로그 + 장바구니)
- `/b2b-orders/[id]` - 지점 주문 상세
- `/b2b-orders/admin` - 본사 전체 주문 관리
- `/b2b-orders/admin/[id]` - 본사 주문 상세

### 기존 파일 수정 (Phase 2)
- `Navigation.tsx` - B2B 발주 드롭다운 메뉴 추가
- `ProductTable.tsx` - B2B 발주가능 토글 + B2B 단가 컬럼 (0000만)
- `UserTable.tsx` - 매니저 B2B 발주권한 토글 (0000/0001만)
- `types/index.ts` - Product에 `is_b2b_orderable`, `b2b_price` 추가
- `get_products_list` RPC - `is_b2b_orderable`, `b2b_price` 반환 추가
- `get_all_users` RPC - `can_b2b_order`, `last_login_at` 반환 추가

### Phase 3: 주문 처리 + 배송/출고

RPC 함수:
- `b2b_approve_order(p_admin_id, p_order_id)` - 주문 승인 (pending_approval→approved)
- `b2b_hold_order(p_admin_id, p_order_id, p_reason)` - 주문 보류 (→on_hold)
- `b2b_resume_order(p_admin_id, p_order_id)` - 보류 해제 (on_hold→approved)
- `b2b_cancel_order(p_admin_id, p_order_id, p_reason)` - 주문 취소 (출고 전만)
- `b2b_generate_shipment_number(p_branch_id)` - 출고번호 자동생성
- `b2b_create_shipment(p_admin_id, p_order_id, p_items, ...)` - 출고 생성 (부분출고 지원)
- `b2b_confirm_receipt(p_user_id, p_shipment_id)` - 수령 확인 (지점)
- `b2b_get_shipments_by_order(p_order_id)` - 주문별 출고 목록

서버 액션 추가:
- `admin/actions.ts` - approveOrder, holdOrder, resumeOrder, cancelOrder, createShipment, getShipmentsForOrder
- `actions.ts` - confirmReceipt, getShipmentsForOrder

컴포넌트:
- `B2bOrderStatusActions` - 상태 변경 버튼 (승인/보류/취소, 사유 입력 다이얼로그)
- `B2bShipmentForm` - 출고 생성 다이얼로그 (아이템별 수량, 택배사, 운송장)
- `B2bShipmentList` - 출고 목록 (확장 상세, 수령확인 버튼)

페이지 확장:
- `/b2b-orders/admin/[id]` - 상태 변경 버튼 + 출고 버튼 + 출고 내역
- `/b2b-orders/[id]` - 출고 내역 + 수령확인 버튼

### Phase 4: 거래명세서

RPC 함수:
- `b2b_generate_statement_number()` - 명세서번호 자동생성 (TS-YYYYMMDD-NNN)
- `b2b_create_statement(p_admin_id, p_order_id, p_items, p_memo)` - 명세서 초안 생성 (부분발행 지원)
- `b2b_issue_statement(p_admin_id, p_statement_id)` - 발행 (statement_data JSONB 스냅샷 저장)
- `b2b_cancel_statement(p_admin_id, p_statement_id, p_reason)` - 명세서 취소
- `b2b_reissue_statement(p_admin_id, p_statement_id, p_reason)` - 재발행 (reissue_count++, 이력 기록)
- `b2b_get_statements_by_order(p_order_id)` - 주문별 명세서 목록
- `b2b_get_statement_detail(p_statement_id)` - 명세서 상세 (인쇄용)

서버 액션 추가:
- `admin/actions.ts` - createStatement, issueStatement, cancelStatement, reissueStatement, getStatementsForOrder, getStatementDetail
- `actions.ts` - getStatementsForOrder (지점용, 발행된 것만 조회)

컴포넌트:
- `B2bStatementCreateForm` - 명세서 생성 다이얼로그 (아이템/수량 선택, 전량 채우기)
- `B2bStatementList` - 명세서 목록 (발행/취소/재발행 버튼, 인쇄, 확장 상세)

페이지 확장:
- `/b2b-orders/admin/[id]` - 거래명세서 생성 버튼 + 명세서 목록 (관리자)
- `/b2b-orders/[id]` - 발행된 거래명세서 조회 (지점, 읽기전용)

### Phase 5: 정산

RPC 함수:
- `b2b_generate_settlement_number()` - 정산번호 자동생성 (STL-YYYYMMDD-NNN)
- `b2b_create_settlement(p_admin_id, p_order_id, p_amount, p_direction, ...)` - 정산 생성 (부분정산 지원)
- `b2b_get_settlements_by_order(p_order_id)` - 주문별 정산 목록
- `b2b_get_settlement_summary(p_order_id)` - 정산 요약 (총정산/미정산/진행률)
- `b2b_complete_order(p_admin_id, p_order_id)` - 주문 완료 (settled→completed)

서버 액션 추가:
- `admin/actions.ts` - createSettlement, getSettlementsForOrder, getSettlementSummary, completeOrder
- `actions.ts` - getSettlementsForOrder, getSettlementSummary (지점용, 원장만)

컴포넌트:
- `B2bSettlementForm` - 정산 생성 다이얼로그 (금액, 방향, 방법, 참조번호)
- `B2bSettlementList` - 정산 내역 목록
- `B2bSettlementSummaryCard` - 정산 현황 카드 (총주문/총정산/미정산/진행률 바)

페이지 확장:
- `/b2b-orders/admin/[id]` - 정산 처리 버튼 + 주문 완료 버튼 + 정산 현황 + 정산 내역
- `/b2b-orders/[id]` - 정산 현황/내역 조회 (원장만, 읽기전용)

### Phase 6: 세금계산서 + 리포트

세금계산서 RPC:
- `b2b_generate_invoice_number()` - 세금계산서 번호 자동생성 (TI-YYYYMMDD-NNN)
- `b2b_create_tax_invoice(p_admin_id, p_order_id, p_memo)` - 세금계산서 생성
- `b2b_update_tax_invoice_status(p_admin_id, p_invoice_id, p_status, ...)` - 상태 변경
- `b2b_get_tax_invoices_by_order(p_order_id)` - 주문별 세금계산서 조회

리포트 RPC:
- `b2b_get_outstanding_report(p_from_date, p_to_date, p_branch_id)` - 미수 리포트
- `b2b_get_settlement_report(p_from_date, p_to_date, p_branch_id)` - 정산 리포트 (지점별 집계)
- `b2b_get_dashboard_stats(p_branch_id)` - 대시보드 통계

서버 액션:
- `admin/tax-invoices/actions.ts` - createTaxInvoice, updateTaxInvoiceStatus, getTaxInvoicesForOrder
- `reports/b2b/actions.ts` - getOutstandingReport, getSettlementReport, getDashboardStats
- `actions.ts` - getTaxInvoicesForOrder (지점용, 원장만)

컴포넌트:
- `B2bTaxInvoiceList` - 세금계산서 목록 (상태변경 버튼, 발행완료/실패/취소 다이얼로그)

페이지:
- `/reports/b2b` - B2B 정산 리포트 (대시보드/미수현황/정산현황 탭)

네비게이션:
- B2B 발주 드롭다운에 "B2B 정산" 메뉴 추가

페이지 확장:
- `/b2b-orders/admin/[id]` - 세금계산서 생성 버튼 + 세금계산서 목록
- `/b2b-orders/[id]` - 세금계산서 조회 (원장만, 발행된 것만)

### 구현 진행 상황
- **Phase 1 완료**: 기반 인프라 (DB 테이블 + RPC + 권한 + 타입)
- **Phase 2 완료**: 핵심 주문 기능 (발주 생성/조회, 서버 액션, UI, 네비게이션)
- **Phase 3 완료**: 주문 처리 + 배송/출고 (승인/보류/취소, 출고 생성, 수령확인)
- **Phase 4 완료**: 거래명세서 (생성/발행/취소/재발행, 인쇄, 지점 조회)
- **Phase 5 완료**: 정산 (생성/부분정산, 주문완료, 지점 원장 조회)
- **Phase 6 완료**: 세금계산서 + 리포트 (생성/상태관리, 미수/정산 리포트, 대시보드)

### 상세 구현 계획
`.claude/plans/immutable-wibbling-coral.md` 파일 참조
`b2b_ordering_system_spec.md` 파일 참조 (초기 사양)

---

## 기존 시스템 완료 이력

### V2 완료
- 품목/거래처 지점별 관리 (branch_id nullable 방식) 구현 완료
- 본사 관리자 공통/지점 선택 기능 추가 완료
- 고객만족도 조사 DB 집계 + 서버 페이지네이션 구현 완료

### P3 완료 (2026-02-13)
- 품목 폼 검증 강화
- `inventory/movements/actions.ts` 레거시 함수 제거
- Dialog ESC/ARIA + ConfirmDialog + useConfirm 훅 → window.confirm 교체
