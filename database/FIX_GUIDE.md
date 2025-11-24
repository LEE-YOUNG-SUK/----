# 입고/판매 내역 조회 오류 해결 가이드

## 🔍 문제 원인

### 발견된 문제점:
1. **RPC 함수 중복**: `get_purchases_list`와 `get_sales_list` 함수가 UUID/TEXT 타입으로 2개씩 존재
2. **테이블 미생성**: `purchases`, `sales`, `inventory_layers` 테이블이 데이터베이스에 없을 가능성

### 에러 메시지:
```
Could not choose the best candidate function between: 
public.get_purchases_list(p_branch_id => uuid, ...), 
public.get_purchases_list(p_branch_id => text, ...)
```

---

## ✅ 해결 방법

### 1단계: Supabase SQL Editor 접속
1. Supabase 대시보드 로그인
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New query** 버튼 클릭

### 2단계: 테이블 생성
`database/purchases_sales_inventory_tables.sql` 파일 내용을 복사하여 실행:
- purchases 테이블
- sales 테이블
- inventory_layers 테이블
- 인덱스, 트리거 생성

### 3단계: 중복 RPC 함수 정리
`database/fix_rpc_functions.sql` 파일 내용을 복사하여 실행:
- 기존 UUID/TEXT 버전 함수 모두 삭제
- TEXT 버전으로 재생성

### 4단계: 확인
다음 쿼리로 테이블과 함수 존재 확인:
```sql
-- 테이블 확인
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('purchases', 'sales', 'inventory_layers');

-- 함수 확인
SELECT routine_name, data_type 
FROM information_schema.parameters 
WHERE specific_schema = 'public' 
AND routine_name IN ('get_purchases_list', 'get_sales_list')
AND parameter_name = 'p_branch_id';
```

예상 결과:
- 테이블 3개 확인: purchases, sales, inventory_layers
- 함수 파라미터 타입: text (UUID 아님!)

---

## 🚀 실행 순서

### Option A: Supabase Dashboard에서 수동 실행 (권장)
1. SQL Editor에서 `purchases_sales_inventory_tables.sql` 실행 → RUN
2. SQL Editor에서 `fix_rpc_functions.sql` 실행 → RUN
3. 애플리케이션 새로고침

### Option B: 명령줄에서 실행 (고급)
```powershell
# Supabase CLI로 직접 실행 (로그인 필요)
npx supabase db push database/purchases_sales_inventory_tables.sql
npx supabase db push database/fix_rpc_functions.sql
```

---

## 📝 실행 후 검증

### 1. 브라우저에서 확인
- `/purchases` 페이지 → 입고 현황 테이블이 보여야 함
- `/sales` 페이지 → 판매 내역 테이블이 보여야 함
- 콘솔 에러 없어야 함

### 2. 테스트 데이터 입력
- 입고 관리에서 샘플 입고 데이터 입력
- 입고 현황에서 데이터 확인
- 판매 관리에서 판매 데이터 입력
- 판매 내역에서 데이터 확인

---

## 🔧 추가 문제 발생 시

### RPC 함수가 여전히 작동하지 않으면:
```sql
-- 모든 버전의 함수 강제 삭제
DROP FUNCTION IF EXISTS get_purchases_list CASCADE;
DROP FUNCTION IF EXISTS get_sales_list CASCADE;

-- 그 다음 fix_rpc_functions.sql 재실행
```

### 권한 오류 발생 시:
```sql
-- 테이블 권한 재설정
GRANT ALL ON public.purchases TO authenticated;
GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.inventory_layers TO authenticated;

-- 함수 권한 재설정
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```

---

## 📚 참고 파일
- `database/purchases_sales_inventory_tables.sql` - 테이블 생성 스크립트
- `database/fix_rpc_functions.sql` - RPC 함수 수정 스크립트
- `database/complete_schema.sql` - 전체 스키마 (참조용)
