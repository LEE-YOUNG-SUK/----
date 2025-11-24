# 입고/판매 내역 조회 문제 최종 진단 가이드

## 🔍 현재 상황
- ✅ sales 테이블에 cost_of_goods_sold, profit 컬럼 존재 확인
- ✅ RPC 함수 생성 완료
- ❌ 여전히 입고 내역, 판매 내역이 표시되지 않음

## 📋 전체 진단 필요

### **1단계: 데이터베이스 전체 상태 확인**

Supabase SQL Editor에서 **`diagnose_database.sql`** 실행

이 스크립트는 다음을 확인합니다:
1. 모든 테이블 목록
2. purchases/sales 테이블 컬럼 구조
3. **실제 데이터 개수** (중요!)
4. RPC 함수 개수 및 시그니처
5. **RPC 함수 직접 실행 테스트** (가장 중요!)
6. 관련 테이블 데이터 확인

---

### **2단계: 브라우저에서 확인 (가장 중요!)**

#### A. Network 탭 확인
1. 브라우저에서 **F12** 키
2. **Network** 탭 선택
3. **Filter: All → Fetch/XHR**
4. 입고 관리 페이지 접속
5. **get_purchases_list** 또는 **rpc** 요청 찾기
6. 클릭해서 **Preview** 또는 **Response** 탭 확인

**예상 에러:**
- 404: 함수를 찾을 수 없음
- 500: 서버 에러
- 빈 배열 []: 데이터는 있지만 조회 안됨

#### B. Console 탭 확인
정확한 에러 메시지 확인

---

### **3단계: 실제 데이터 확인**

```sql
-- purchases 테이블에 데이터가 있는지 확인
SELECT COUNT(*) FROM public.purchases;
SELECT * FROM public.purchases LIMIT 5;

-- sales 테이블에 데이터가 있는지 확인
SELECT COUNT(*) FROM public.sales;
SELECT * FROM public.sales LIMIT 5;
```

**데이터가 0건이면?**
→ 입고/판매를 먼저 등록해야 함!

---

### **4단계: RPC 함수 직접 테스트**

```sql
-- 함수를 직접 호출해서 결과 확인
SELECT * FROM public.get_purchases_list(NULL, NULL, NULL);
SELECT * FROM public.get_sales_list(NULL, NULL, NULL);
```

**에러가 나면?**
- 어떤 에러인지 정확히 확인
- 테이블/컬럼 이름 오타 가능성

---

## 🎯 가능한 원인들

### 원인 1: 데이터가 실제로 없음
- **확인**: `SELECT COUNT(*) FROM purchases;`
- **해결**: 입고 관리에서 데이터 먼저 입력

### 원인 2: RPC 함수 시그니처 여전히 문제
- **확인**: diagnose_database.sql의 함수 개수 확인
- **해결**: 완전 삭제 후 재생성

### 원인 3: WHERE 조건 문제
```sql
-- 현재 코드 문제점 발견!
WHERE 
    (p_branch_id IS NULL OR p.branch_id = p_branch_id)  -- ❌ 이 조건이 문제!
```

**문제**: 파라미터 이름(`p_branch_id`)과 테이블 컬럼 비교가 모호함!

---

## ✅ 즉시 실행할 수정 사항

RPC 함수의 WHERE 절에 문제가 있습니다. 수정된 함수를 실행하세요:

```sql
-- get_purchases_list 수정 (WHERE 조건 명확하게)
CREATE OR REPLACE FUNCTION public.get_purchases_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, branch_id TEXT, branch_name TEXT, client_id TEXT, client_name TEXT,
  product_id TEXT, product_code TEXT, product_name TEXT, unit TEXT,
  purchase_date DATE, quantity NUMERIC, unit_cost NUMERIC, total_cost NUMERIC,
  reference_number TEXT, notes TEXT, created_at TIMESTAMPTZ, created_by TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.branch_id, COALESCE(b.name, '') AS branch_name,
    p.client_id, COALESCE(c.name, '') AS client_name,
    p.product_id, COALESCE(pr.code, '') AS product_code,
    COALESCE(pr.name, '') AS product_name, COALESCE(pr.unit, '') AS unit,
    p.purchase_date, p.quantity, p.unit_cost, p.total_cost,
    COALESCE(p.reference_number, '') AS reference_number,
    COALESCE(p.notes, '') AS notes, p.created_at,
    COALESCE(p.created_by, '') AS created_by
  FROM public.purchases p
  LEFT JOIN public.branches b ON p.branch_id = b.id
  LEFT JOIN public.clients c ON p.client_id = c.id
  LEFT JOIN public.products pr ON p.product_id = pr.id
  WHERE 
    (get_purchases_list.p_branch_id IS NULL OR p.branch_id = get_purchases_list.p_branch_id)
    AND (get_purchases_list.p_start_date IS NULL OR p.purchase_date >= get_purchases_list.p_start_date)
    AND (get_purchases_list.p_end_date IS NULL OR p.purchase_date <= get_purchases_list.p_end_date)
  ORDER BY p.purchase_date DESC, p.created_at DESC;
END;
$$;

-- get_sales_list도 동일하게 수정
CREATE OR REPLACE FUNCTION public.get_sales_list(
  p_branch_id TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, branch_id TEXT, branch_name TEXT, client_id TEXT, client_name TEXT,
  product_id TEXT, product_code TEXT, product_name TEXT, unit TEXT,
  sale_date DATE, quantity NUMERIC, unit_price NUMERIC, total_price NUMERIC,
  cost_of_goods_sold NUMERIC, profit NUMERIC,
  reference_number TEXT, notes TEXT, created_at TIMESTAMPTZ, created_by TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, s.branch_id, COALESCE(b.name, '') AS branch_name,
    s.client_id, COALESCE(c.name, '') AS client_name,
    s.product_id, COALESCE(pr.code, '') AS product_code,
    COALESCE(pr.name, '') AS product_name, COALESCE(pr.unit, '') AS unit,
    s.sale_date, s.quantity, s.unit_price, s.total_price,
    COALESCE(s.cost_of_goods_sold, 0) AS cost_of_goods_sold,
    COALESCE(s.profit, 0) AS profit,
    COALESCE(s.reference_number, '') AS reference_number,
    COALESCE(s.notes, '') AS notes, s.created_at,
    COALESCE(s.created_by, '') AS created_by
  FROM public.sales s
  LEFT JOIN public.branches b ON s.branch_id = b.id
  LEFT JOIN public.clients c ON s.client_id = c.id
  LEFT JOIN public.products pr ON s.product_id = pr.id
  WHERE 
    (get_sales_list.p_branch_id IS NULL OR s.branch_id = get_sales_list.p_branch_id)
    AND (get_sales_list.p_start_date IS NULL OR s.sale_date >= get_sales_list.p_start_date)
    AND (get_sales_list.p_end_date IS NULL OR s.sale_date <= get_sales_list.p_end_date)
  ORDER BY s.sale_date DESC, s.created_at DESC;
END;
$$;
```

**핵심 변경점**: 
- `p.branch_id = p_branch_id` → `p.branch_id = get_purchases_list.p_branch_id`
- 함수명으로 파라미터를 명확하게 참조!

---

## 🚀 실행 순서

1. **`diagnose_database.sql`** 실행 → 결과 확인
2. **위의 수정된 RPC 함수** 실행
3. **서버 재시작**: Ctrl+C → `npm run dev`
4. **브라우저 새로고침**: Ctrl+Shift+R
5. **Network/Console 탭** 에서 에러 확인

결과를 알려주세요!
