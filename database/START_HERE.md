# 🎯 최종 실행 가이드 - 처음부터 끝까지

## 📋 현재 상황 요약
- **목표**: 입고/판매에 부가세(supply_price, tax_amount, total_price) 기능 추가
- **문제**: 무한루프, 함수 파라미터 불일치, Supabase 경고
- **해결 파일**: 
  - `FINAL_SAFE_FIX_V4.sql` - 부가세 기능 완전 구현
  - `FIX_SUPABASE_WARNINGS.sql` - Supabase 경고 해결

---

## 🚀 Step-by-Step 실행 가이드

### ✅ STEP 0: 사전 준비 (5분)

#### 0-1. Supabase 백업 생성 (필수!)
1. 브라우저에서 Supabase 대시보드 열기
2. 프로젝트 선택
3. **Database** → **Backups** 클릭
4. **"Create backup"** 버튼 클릭
5. 이름: `before_final_fix_20250130`
6. 완료될 때까지 대기 (1-2분)

✅ 체크: 백업이 목록에 표시됨

---

### ✅ STEP 1: 현재 DB 상태 확인 (2분)

#### 1-1. Supabase SQL Editor 열기
1. Supabase 대시보드
2. **SQL Editor** 클릭
3. **New query** 버튼

#### 1-2. 현재 상태 확인 쿼리 실행
아래 쿼리를 복사 → SQL Editor에 붙여넣기 → **Run** 클릭

```sql
-- 1. 현재 트리거 확인
SELECT 
  t.tgname AS trigger_name,
  CASE 
    WHEN t.tgtype & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    WHEN t.tgtype & 8 = 8 THEN 'DELETE'
  END AS event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'purchases' AND NOT t.tgisinternal;

-- 2. 제약 조건 확인
SELECT 
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'purchases'
  AND column_name IN ('supply_price', 'tax_amount', 'total_price');

-- 3. NULL 값 개수 확인
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE supply_price IS NULL) as null_supply_price,
  COUNT(*) FILTER (WHERE tax_amount IS NULL) as null_tax_amount,
  COUNT(*) FILTER (WHERE total_price IS NULL) as null_total_price
FROM purchases;
```

**결과 기록:**
- 트리거 개수: ___개
- supply_price nullable: YES / NO
- NULL 값 개수: ___개

---

### ✅ STEP 2: 메인 수정 스크립트 실행 (10분)

#### 2-1. FINAL_SAFE_FIX_V4.sql 열기
VS Code에서 `database/FINAL_SAFE_FIX_V4.sql` 파일 열기

#### 2-2. 전체 스크립트 복사
- `Ctrl+A` (전체 선택)
- `Ctrl+C` (복사)

#### 2-3. Supabase SQL Editor에서 실행
1. Supabase SQL Editor → **New query**
2. `Ctrl+V` (붙여넣기)
3. **Run** 버튼 클릭
4. ⏱️ 실행 시간: 10-30초 예상

#### 2-4. 실행 결과 확인 (중요!)
**Results 탭** 아래 **Messages 탭** 클릭

**예상 출력:**
```
✅ Step 1 완료: 모든 트리거 제거
✅ Step 2 완료: 기존 RPC 함수 삭제
✅ Step 3 완료: purchases X 행, sales Y 행 업데이트
✅ Step 3 검증 통과: NULL 값 없음
✅ Step 4 완료: NOT NULL 제약 조건 추가
✅ Step 5 완료: 트리거 함수 재생성
✅ Step 6 완료: 트리거 생성 (INSERT만)
✅ Step 7 완료: 신규 RPC 함수 생성
==================================================
✨ 최종 검증 결과
==================================================
트리거 개수: 3 (예상: 3)
process_purchase_with_layers 존재: t
process_sale_with_fifo 존재: t
purchases NULL 레코드: 0 (예상: 0)
sales NULL 레코드: 0 (예상: 0)
==================================================
✅ 모든 검증 통과!
```

#### 2-5. 에러 발생 시
**에러 있음?**
- 에러 메시지 전체 복사
- 저에게 전달 (추가 수정)

**에러 없음?**
- ✅ 다음 단계로!

---

### ✅ STEP 3: Supabase 경고 해결 (3분)

#### 3-1. FIX_SUPABASE_WARNINGS.sql 열기
VS Code에서 `database/FIX_SUPABASE_WARNINGS.sql` 파일 열기

#### 3-2. 전체 스크립트 복사 및 실행
1. `Ctrl+A` → `Ctrl+C`
2. Supabase SQL Editor → **New query**
3. `Ctrl+V` → **Run**

**예상 출력:**
```
정책 삭제: public.clients - Admins and managers can insert clients
...
✅ RLS 정책 및 활성화 완전 제거
✅ 모든 RLS 에러 해결 완료
```

---

### ✅ STEP 4: DB 검증 (5분)

#### 4-1. 트리거 검증
```sql
SELECT 
  t.tgname,
  CASE t.tgtype & 66 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
  CASE 
    WHEN t.tgtype & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
  END AS event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'purchases' AND NOT t.tgisinternal;
```

**예상 결과: 3개**
```
set_total_cost                      | BEFORE | INSERT
create_inventory_layer_on_purchase  | AFTER  | INSERT
update_last_purchase_info           | AFTER  | INSERT
```

✅ UPDATE 트리거 없음 확인!

#### 4-2. RPC 함수 검증
```sql
SELECT 
  proname,
  pg_get_function_arguments(oid) AS params
FROM pg_proc
WHERE proname IN ('process_purchase_with_layers', 'process_sale_with_fifo')
  AND pronamespace = 'public'::regnamespace;
```

**예상 결과:**
- `p_supply_price numeric` 포함 ✅
- `p_tax_amount numeric` 포함 ✅
- `p_total_price numeric` 포함 ✅

#### 4-3. 제약 조건 검증
```sql
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name IN ('purchases', 'sales')
  AND column_name IN ('supply_price', 'tax_amount', 'total_price', 'profit')
ORDER BY table_name, column_name;
```

**예상 결과:**
```
purchases | supply_price | NO  | numeric  ✅
purchases | tax_amount   | NO  | numeric  ✅
purchases | total_price  | NO  | numeric  ✅
sales     | supply_price | NO  | numeric  ✅
sales     | tax_amount   | NO  | numeric  ✅
sales     | total_price  | NO  | numeric  ✅
sales     | profit       | YES | numeric  ✅ (nullable!)
```

---

### ✅ STEP 5: 애플리케이션 테스트 (10분)

#### 5-1. 개발 서버 시작
```powershell
npm run dev
```

브라우저: http://localhost:3000

#### 5-2. 입고 테스트 (부가세 포함)

**URL:** http://localhost:3000/purchases

1. **로그인** (아직 안했다면)
2. **공급업체 선택** (아무거나)
3. **"부가세 포함" 체크** ✅
4. **품목 추가:**
   - 품목: 테스트용 품목 선택
   - 수량: `10`
   - 단가: `11000`
5. **자동 계산 확인:**
   - 공급가: `100000` ← 계산됨
   - 부가세: `10000` ← 계산됨
   - 합계: `110000` ← 계산됨
6. **저장 버튼 클릭**

**예상 결과:**
- ✅ "입고 저장 성공" 또는 성공 메시지
- ✅ 1-2초 내 완료 (무한루프 아님!)
- ✅ 에러 팝업 없음

**실패 시:**
- 브라우저 콘솔 확인 (F12 → Console 탭)
- 에러 메시지 복사해서 전달

#### 5-3. DB에서 확인
Supabase SQL Editor:
```sql
SELECT 
  id,
  product_id,
  quantity,
  unit_cost,
  supply_price,   -- 100000
  tax_amount,     -- 10000
  total_price,    -- 110000
  total_cost,     -- 110000
  created_at
FROM purchases
ORDER BY created_at DESC
LIMIT 1;
```

**예상 결과:**
- supply_price: 100000 ✅
- tax_amount: 10000 ✅
- total_price: 110000 ✅

#### 5-4. 재고 레이어 확인
```sql
SELECT 
  product_id,
  original_quantity,   -- 10
  remaining_quantity,  -- 10
  unit_cost,           -- 11000
  created_at
FROM inventory_layers
ORDER BY created_at DESC
LIMIT 1;
```

**예상 결과:**
- original_quantity: 10 ✅
- remaining_quantity: 10 ✅

#### 5-5. 판매 테스트 (FIFO)

**URL:** http://localhost:3000/sales

1. **고객 선택**
2. **"부가세 포함" 체크**
3. **품목 추가:**
   - 품목: 위에서 입고한 품목
   - 수량: `3`
   - 단가: `16500`
4. **자동 계산 확인:**
   - 공급가: `45000`
   - 부가세: `4500`
   - 합계: `49500`
5. **저장 버튼 클릭**

#### 5-6. 판매 DB 확인
```sql
SELECT 
  id,
  quantity,
  unit_price,
  supply_price,        -- 45000
  tax_amount,          -- 4500
  total_price,         -- 49500
  cost_of_goods_sold,  -- 33000 (11000 × 3)
  profit,              -- 12000 (45000 - 33000)
  created_at
FROM sales
ORDER BY created_at DESC
LIMIT 1;
```

**예상 결과:**
- supply_price: 45000 ✅
- tax_amount: 4500 ✅
- total_price: 49500 ✅
- cost_of_goods_sold: 33000 ✅
- profit: 12000 ✅

#### 5-7. 재고 차감 확인
```sql
SELECT 
  product_id,
  original_quantity,   -- 10
  remaining_quantity,  -- 7 (10 - 3)
  unit_cost
FROM inventory_layers
WHERE product_id = (
  SELECT product_id FROM sales ORDER BY created_at DESC LIMIT 1
)
ORDER BY purchase_date ASC;
```

**예상 결과:**
- remaining_quantity: 7 ✅ (10에서 3 차감)

---

## ✅ 최종 체크리스트

### DB 완료 확인
- [ ] 트리거 3개 (INSERT만, UPDATE 없음)
- [ ] RPC 함수에 supply_price, tax_amount, total_price 파라미터
- [ ] purchases.supply_price NOT NULL
- [ ] purchases.tax_amount NOT NULL
- [ ] purchases.total_price NOT NULL
- [ ] sales.supply_price NOT NULL
- [ ] sales.tax_amount NOT NULL
- [ ] sales.total_price NOT NULL
- [ ] sales.profit nullable

### 애플리케이션 완료 확인
- [ ] 입고 (부가세 포함) 성공
- [ ] 입고 DB 저장 확인 (supply_price, tax_amount, total_price)
- [ ] 재고 레이어 자동 생성
- [ ] 판매 (FIFO) 성공
- [ ] 판매 DB 저장 확인 (부가세 + 원가 + 이익)
- [ ] 재고 차감 확인
- [ ] 무한루프 없음 (1-2초 내 완료)
- [ ] 에러 없음

---

## 🚨 문제 발생 시 대응

### 문제 1: "trigger already exists"
**Step 1부터 다시:**
```sql
-- Supabase SQL Editor
DROP TRIGGER IF EXISTS set_total_cost ON purchases;
DROP TRIGGER IF EXISTS create_inventory_layer_on_purchase ON purchases;
DROP TRIGGER IF EXISTS update_last_purchase_info ON purchases;
```
→ 그 후 FINAL_SAFE_FIX_V4.sql 전체 재실행

### 문제 2: "column cannot be null"
**NULL 값 수동 채우기:**
```sql
UPDATE purchases
SET 
  supply_price = COALESCE(supply_price, ROUND(total_cost / 1.1, 2)),
  tax_amount = COALESCE(tax_amount, ROUND((total_cost / 1.1) * 0.1, 0)),
  total_price = COALESCE(total_price, total_cost)
WHERE supply_price IS NULL OR tax_amount IS NULL OR total_price IS NULL;
```
→ Step 4부터 재실행

### 문제 3: 무한루프 지속
**트리거 완전 제거:**
```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'purchases' AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON purchases', r.tgname);
  END LOOP;
END $$;
```
→ Step 1부터 재실행

### 문제 4: RPC 함수 파라미터 불일치
**완전 삭제 후 재생성:**
```sql
DROP FUNCTION IF EXISTS process_purchase_with_layers CASCADE;
DROP FUNCTION IF EXISTS process_sale_with_fifo CASCADE;
```
→ Step 7부터 재실행

---

## 📞 도움 요청 시 제공할 정보

문제 발생 시 아래 정보 수집:

### 1. 에러 메시지
- Supabase SQL Editor 에러 메시지 전체
- 브라우저 콘솔 (F12 → Console) 에러

### 2. 현재 상태
```sql
-- 1. 트리거 목록
SELECT tgname, tgtype FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'purchases' AND NOT t.tgisinternal;

-- 2. NULL 값 개수
SELECT COUNT(*) FROM purchases 
WHERE supply_price IS NULL OR tax_amount IS NULL OR total_price IS NULL;

-- 3. 함수 존재 여부
SELECT proname FROM pg_proc 
WHERE proname IN ('process_purchase_with_layers', 'process_sale_with_fifo');
```

### 3. 실행한 단계
- 어느 Step까지 완료했는지
- 어느 Step에서 에러 발생했는지

---

## 🎉 성공 후 할 일

### 단기 (완료 확인)
1. 입고 2-3건 더 테스트
2. 판매 2-3건 더 테스트
3. 재고 조회 확인
4. 부가세 금액 정확성 확인

### 중기 (선택 사항)
1. 입고/판매 내역 조회 화면에 부가세 컬럼 표시
2. 통계 화면에 부가세 집계
3. 엑셀 내보내기에 부가세 포함

---

**지금 Step 0부터 시작하세요! 🚀**

각 단계 완료 시마다 체크리스트 체크하며 진행하시면 됩니다.
