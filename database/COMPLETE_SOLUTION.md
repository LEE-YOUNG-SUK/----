# 입고/판매 내역 조회 문제 완전 해결 가이드

## 🔍 문제 분석 완료

### 확인된 문제점:
1. **RPC 함수 중복**: UUID/TEXT 타입 함수가 동시에 존재
2. **테이블 컬럼 누락**: sales 테이블에 cost_of_goods_sold, profit 컬럼 없음
3. **함수 시그니처 충돌**: Supabase가 어떤 함수를 호출할지 결정 못함

---

## ✅ 완전 해결 방법 (순서대로 실행)

### **1단계: 데이터베이스 완전 초기화**

Supabase SQL Editor에서 실행:

**파일: `database/complete_fix.sql`** (새로 생성한 파일)

이 스크립트는:
- ✅ 모든 중복 RPC 함수를 완전히 제거
- ✅ TEXT 타입 파라미터로 함수 재생성
- ✅ COALESCE로 NULL 처리 추가
- ✅ 자동 검증 포함

---

### **2단계: 테이블 확인 및 수정**

같은 SQL Editor에서 추가 실행:

```sql
-- sales 테이블에 필요한 컬럼 추가
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS cost_of_goods_sold NUMERIC(15, 2);

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS profit NUMERIC(15, 2);

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- purchases 테이블도 확인
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales' AND table_schema = 'public'
ORDER BY ordinal_position;
```

---

### **3단계: 함수 검증**

```sql
-- 함수 개수 확인 (각각 1개여야 함!)
SELECT proname, COUNT(*) as count
FROM pg_proc 
WHERE proname IN ('get_purchases_list', 'get_sales_list')
GROUP BY proname;

-- 함수 시그니처 확인
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as parameters
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('get_purchases_list', 'get_sales_list')
ORDER BY p.proname;
```

**예상 결과:**
```
function_name       | count
--------------------|------
get_purchases_list  | 1     ✅
get_sales_list      | 1     ✅
```

**파라미터 타입:**
```
get_purchases_list | p_branch_id text, p_start_date date, p_end_date date
get_sales_list     | p_branch_id text, p_start_date date, p_end_date date
```

---

### **4단계: 애플리케이션 재시작**

```powershell
# 개발 서버 재시작
Ctrl+C (서버 종료)
npm run dev
```

---

### **5단계: 브라우저 테스트**

1. **브라우저 하드 리프레시**: `Ctrl + Shift + R` (캐시 완전 삭제)
2. **개발자 도구** 열기: `F12`
3. **Console 탭** 확인
4. **입고 관리** 페이지 접속: `http://localhost:3000/purchases`
5. **판매 관리** 페이지 접속: `http://localhost:3000/sales`

---

## 🎯 예상 결과

### ✅ 성공 시:
- 입고 현황 테이블에 데이터 표시
- 판매 내역 테이블에 데이터 표시
- 콘솔 에러 없음

### ❌ 여전히 실패 시:

**콘솔에서 정확한 에러 메시지 확인 후:**

1. **"Could not choose the best candidate function" 에러**:
   ```sql
   -- 모든 함수 강제 삭제 후 재생성
   DROP FUNCTION IF EXISTS get_purchases_list CASCADE;
   DROP FUNCTION IF EXISTS get_sales_list CASCADE;
   
   -- complete_fix.sql의 2단계 부분만 다시 실행
   ```

2. **"column does not exist" 에러**:
   - 어떤 컬럼이 없는지 확인
   - 해당 테이블에 컬럼 추가

3. **"relation does not exist" 에러**:
   ```sql
   -- 테이블 존재 확인
   SELECT tablename FROM pg_tables WHERE tablename IN ('purchases', 'sales', 'inventory_layers');
   
   -- 없으면 purchases_sales_inventory_tables.sql 실행
   ```

---

## 📊 최종 확인 체크리스트

- [ ] `complete_fix.sql` 실행 완료
- [ ] sales 테이블에 cost_of_goods_sold 컬럼 존재
- [ ] RPC 함수 각각 1개만 존재
- [ ] 함수 파라미터 타입이 text
- [ ] 서버 재시작 완료
- [ ] 브라우저 캐시 삭제 완료
- [ ] 입고 현황 데이터 표시됨
- [ ] 판매 내역 데이터 표시됨

---

## 🆘 긴급 문제 해결

모든 단계를 수행했는데도 안 될 경우:

1. **Supabase 대시보드 → Logs** 에서 실시간 에러 확인
2. **브라우저 Network 탭** 에서 RPC 호출 실패 확인
3. **터미널의 서버 로그** 에서 에러 메시지 확인

에러 메시지와 함께 문의하면 정확한 해결책 제공 가능합니다.
