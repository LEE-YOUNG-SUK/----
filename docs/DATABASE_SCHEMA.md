# Drevers ERP 데이터베이스 스키마

**버전**: 2.0  
**최종 업데이트**: 2025-12-05

---

## 📋 테이블 개요

| 테이블명 | 설명 | 주요 컬럼 |
|---------|------|----------|
| `sessions` | 세션 관리 | token, expires_at |
| `users` | 사용자 | username, role, branch_id |
| `branches` | 지점 | code, name |
| `clients` | 거래처 | code, name, type |
| `products` | 품목 | code, name, standard_purchase_price, standard_sale_price |
| `purchases` | 입고 | quantity, unit_cost, supply_price, tax_amount, total_price |
| `sales` | 판매 | quantity, unit_price, supply_price, tax_amount, total_price |
| `inventory_layers` | FIFO 재고 | remaining_quantity, source_type |
| `inventory_adjustments` | 재고 조정 | adjustment_type, is_cancelled |
| `audit_logs` | 감사 로그 | action, changed_fields |

---

## 🔑 핵심 테이블 상세

### 1. purchases (입고)

```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL,           -- FK: branches
    client_id UUID NOT NULL,           -- FK: clients (공급업체)
    product_id UUID NOT NULL,          -- FK: products
    purchase_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL,  -- 입고 단가
    supply_price NUMERIC(15,2),        -- 공급가 (VAT 별도)
    tax_amount NUMERIC(15,2),          -- 부가세
    total_price NUMERIC(15,2),         -- 합계 (공급가 + 부가세)
    total_cost NUMERIC(15,2),          -- 기존 호환
    reference_number VARCHAR(50),      -- 거래번호 (배치 그룹핑용)
    notes TEXT,
    created_by UUID,                   -- FK: users
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### 2. sales (판매)

```sql
CREATE TABLE sales (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL,           -- FK: branches
    client_id UUID,                    -- FK: clients (고객, NULL 허용!)
    product_id UUID NOT NULL,          -- FK: products
    sale_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL, -- 판매 단가
    supply_price NUMERIC(15,2),        -- 공급가 (VAT 별도)
    tax_amount NUMERIC(15,2),          -- 부가세
    total_price NUMERIC(15,2),         -- 합계 (공급가 + 부가세)
    cost_of_goods_sold NUMERIC(15,2),  -- FIFO 매출원가
    profit NUMERIC(15,2),              -- 이익
    reference_number VARCHAR(50),      -- 거래번호
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### 3. inventory_layers (FIFO 재고)

```sql
CREATE TABLE inventory_layers (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    purchase_id UUID,                  -- 원본 입고 ID
    purchase_date DATE NOT NULL,       -- FIFO 정렬 기준
    unit_cost NUMERIC(15,2) NOT NULL,
    original_quantity INTEGER,         -- 최초 수량
    remaining_quantity INTEGER,        -- 남은 수량 (음수 가능!)
    source_type TEXT,                  -- 'PURCHASE' | 'ADJUSTMENT'
    source_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## 💡 중요 설계 결정

### 1. ID 타입: UUID

모든 테이블의 Primary Key는 `UUID` 타입을 사용합니다.

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**이유**:
- 분산 시스템에서 충돌 없는 ID 생성
- 예측 불가능하여 보안성 향상
- Supabase 기본 권장사항

### 2. client_id NULL 허용 차이

| 테이블 | client_id | 이유 |
|--------|-----------|------|
| `purchases` | NOT NULL | 공급업체 필수 (입고 추적) |
| `sales` | NULL 허용 | 고객 없는 현금 판매 가능 |

### 3. 마이너스 재고 허용

`inventory_layers.remaining_quantity`에 CHECK 제약 조건 없음.

```sql
-- 이전 (제약 있음)
remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0)

-- 현재 (제약 없음)
remaining_quantity INTEGER NOT NULL
```

**이유**: 입고 전 판매(선판매) 허용

### 4. VAT 컬럼 설계

```
unit_cost/unit_price  : 사용자 입력 단가
supply_price          : 공급가 (quantity × unit_cost ÷ 1.1)
tax_amount            : 부가세 (quantity × unit_cost - supply_price)
total_price           : 합계 (supply_price + tax_amount)
```

**부가세 포함 입력 시 계산**:
```javascript
const supply_price = Math.round((quantity * unit_cost) / 1.1)
const tax_amount = quantity * unit_cost - supply_price
const total_price = supply_price + tax_amount  // = quantity * unit_cost
```

---

## 🔄 RPC 함수 목록

| 함수명 | 파라미터 | 설명 |
|--------|---------|------|
| `process_batch_purchase` | branch_id, client_id, items(jsonb) | 일괄 입고 |
| `process_batch_sale` | branch_id, client_id, items(jsonb) | 일괄 판매 |
| `get_purchases_list` | branch_id, start_date, end_date | 입고 내역 조회 |
| `get_sales_list` | branch_id, start_date, end_date | 판매 내역 조회 |
| `update_purchase` | purchase_id, quantity, unit_cost, ... | 입고 수정 |
| `update_sale` | sale_id, quantity, unit_price, ... | 판매 수정 |
| `delete_purchase` | purchase_id | 입고 삭제 + 재고 복원 |
| `delete_sale` | sale_id | 판매 삭제 + 재고 복원 |
| `get_inventory_summary` | branch_id | 재고 현황 |
| `get_inventory_layers_detail` | branch_id, product_id | FIFO 레이어 상세 |

---

## 📁 SQL 파일 구조

```
database/
├── schema_v2_complete.sql          # ✅ 최신 통합 스키마 (2025-12-05)
├── purchases_sales_inventory_tables.sql  # 입고/판매/재고 테이블
├── phase1_batch_rpc_functions.sql  # 배치 처리 RPC
├── purchases_sales_rpc_functions.sql  # 조회 RPC
├── phase3_audit_log_schema.sql     # 감사 로그
├── phase3_audit_rpc_functions.sql  # 감사 로그 RPC
├── phase5_inventory_adjustments_schema.sql  # 재고 조정
├── phase5_inventory_adjustments_rpc.sql  # 재고 조정 RPC
└── phase6_reports_rpc_functions.sql  # 리포트 RPC
```

---

## ⚠️ 주의사항

### 1. RLS 비활성화

모든 핵심 테이블은 RLS가 **비활성화**되어 있습니다.

```sql
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
```

**권한 관리**는 Server Actions에서 수행합니다.

### 2. 타입 일치 확인

TypeScript 타입과 DB 컬럼이 일치하는지 확인:
- `types/database.ts` - DB 스키마 대응 타입
- `types/purchases.ts` - 입고 관련 타입
- `types/sales.ts` - 판매 관련 타입

### 3. 마이그레이션 시 주의

기존 데이터가 있는 테이블에 NOT NULL 컬럼 추가 시:

```sql
-- ❌ 잘못된 방법
ALTER TABLE purchases ADD COLUMN supply_price NUMERIC NOT NULL;

-- ✅ 올바른 방법
ALTER TABLE purchases ADD COLUMN supply_price NUMERIC NOT NULL DEFAULT 0;
```

---

## 📊 ERD (Entity Relationship Diagram)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   branches  │     │   clients   │     │  products   │
│─────────────│     │─────────────│     │─────────────│
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ code        │     │ code        │     │ code        │
│ name        │     │ name        │     │ name        │
└──────┬──────┘     │ type        │     │ unit        │
       │            └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    ┌──────────────┼───────────────────┤
       │    │              │                   │
       ▼    ▼              ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                    purchases                         │
│─────────────────────────────────────────────────────│
│ id (PK)                                             │
│ branch_id (FK) ────────────────────────────────────►│
│ client_id (FK) ────────────────────────────────────►│
│ product_id (FK) ───────────────────────────────────►│
│ quantity, unit_cost, supply_price, tax_amount       │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                 inventory_layers                     │
│─────────────────────────────────────────────────────│
│ id (PK)                                             │
│ branch_id (FK), product_id (FK)                     │
│ purchase_id (FK) ──────────────────────────────────►│
│ remaining_quantity (FIFO)                           │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                      sales                           │
│─────────────────────────────────────────────────────│
│ id (PK)                                             │
│ branch_id (FK), client_id (FK, nullable)            │
│ product_id (FK)                                     │
│ quantity, unit_price, cost_of_goods_sold, profit    │
└─────────────────────────────────────────────────────┘
```

---

## 🔗 관련 문서

- [개발 교훈](./DEVELOPMENT_LESSONS.md)
- [다음 작업](./NEXT_TASKS.md)
- [Phase 5 인수인계](../PHASE5_HANDOVER.md)
- [Phase 6 인수인계](../PHASE6_HANDOVER.md)

