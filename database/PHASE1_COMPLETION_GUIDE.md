# Phase 1: 트랜잭션 처리 강화 - 완료 가이드

## ✅ 구현 완료 내용

### 1. 데이터베이스 RPC 함수 (3개)
- ✅ `generate_transaction_number()` - 거래번호 자동 생성
- ✅ `process_batch_purchase()` - 입고 일괄 저장 (트랜잭션)
- ✅ `process_batch_sale()` - 판매 일괄 저장 (FIFO + 트랜잭션)

### 2. TypeScript 타입 정의
- ✅ `BatchPurchaseResponse` - 입고 RPC 응답 타입
- ✅ `BatchSaleResponse` - 판매 RPC 응답 타입

### 3. Server Actions 수정
- ✅ `app/purchases/actions.ts` - 단일 RPC 호출로 변경
- ✅ `app/sales/actions.ts` - 단일 RPC 호출로 변경

---

## 🎯 핵심 개선 사항

### Before (기존)
```typescript
// ❌ 품목별로 개별 RPC 호출 (부분 성공 허용)
for (const item of data.items) {
  const { data, error } = await supabase.rpc('process_purchase_with_layers', ...)
  if (error) errors.push(...)  // 계속 진행
}
// 결과: 5개 품목 중 3개 성공 시 3개만 저장됨
```

### After (Phase 1)
```typescript
// ✅ 단일 RPC 호출 (전체 트랜잭션)
const { data, error } = await supabase.rpc('process_batch_purchase', {
  p_items: itemsJson  // 전체 품목 한번에 전달
})
// 결과: 5개 품목 중 1개라도 실패하면 전체 롤백
```

### 주요 기능

#### 1. 트랜잭션 보장
- **ACID 원칙 준수**: 모든 품목이 성공하거나 모두 실패
- **예외 처리**: `EXCEPTION WHEN OTHERS` 블록에서 자동 롤백
- **동시성 제어**: `FOR UPDATE` 락으로 재고 동시 판매 방지

#### 2. 거래번호 자동 생성
- **형식**: `{지점코드}-{YYYYMMDD}-{PUR|SAL}-{001}`
- **예시**: `B01-20250126-PUR-001` (B01 지점 1월26일 첫 입고)
- **중복 방지**: `FOR UPDATE` 락으로 동시 요청 대응
- **수동 입력**: 클라이언트에서 제공 시 그대로 사용 (중복 체크)

#### 3. 권한 검증 강화
- **본인 지점만 입력**: 시스템 관리자(0000) 외에는 `branch_id` 확인
- **조기 실패**: 권한 없으면 DB 작업 전 차단

#### 4. 재고 부족 사전 체크 (판매)
- **전체 품목 검증**: 1개라도 재고 부족하면 저장 시작 안함
- **FIFO 차감 전**: 재고 확인 → 모두 충분하면 차감 시작
- **롤백 보장**: 중간 실패 시 이미 차감된 재고도 복구

---

## 🚀 배포 절차

### Step 1: Supabase에 RPC 함수 등록

1. Supabase SQL Editor 접속
2. `database/phase1_batch_rpc_functions.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

**예상 출력:**
```
NOTICE:  ✅ 거래번호 자동 생성: B01-20250126-PUR-001
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
GRANT
GRANT
GRANT
```

**오류 발생 시:**
- `permission denied` → Supabase 프로젝트 Owner 권한 확인
- `function already exists` → 이미 등록됨 (정상)
- `syntax error` → SQL 복사 시 누락 확인

### Step 2: 함수 등록 검증

```sql
-- 1. 함수 존재 확인
SELECT 
  proname AS function_name,
  prosrc LIKE '%process_batch%' AS is_batch_function
FROM pg_proc
WHERE proname IN ('generate_transaction_number', 'process_batch_purchase', 'process_batch_sale');

-- 예상 결과: 3개 행 반환

-- 2. 거래번호 생성 테스트 (실제 저장 안됨)
SELECT generate_transaction_number(
  '지점_UUID'::UUID,  -- 실제 지점 ID 입력
  CURRENT_DATE,
  'PUR'
);
-- 예상: B01-20250126-PUR-001
```

### Step 3: 애플리케이션 재시작

```powershell
# 개발 서버 재시작
cd "C:\Users\k1her\OneDrive\바탕 화면\호스팅\drevers-erp-next"
npm run dev
```

---

## 🧪 테스트 시나리오

### 테스트 1: 입고 트랜잭션 (전체 성공)

#### 준비
1. 입고 관리 페이지 접속
2. 공급업체 선택
3. 3개 품목 입력 (모두 유효한 데이터)

#### 실행
1. "저장" 버튼 클릭
2. 성공 메시지 확인

#### 검증
```sql
-- 1. 거래번호 동일한지 확인
SELECT reference_number, COUNT(*) 
FROM purchases 
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY reference_number
ORDER BY MAX(created_at) DESC;
-- 예상: 최신 거래번호에 3개 품목

-- 2. inventory_layers 생성 확인
SELECT COUNT(*) 
FROM inventory_layers 
WHERE purchase_id IN (
  SELECT id FROM purchases 
  WHERE created_at > NOW() - INTERVAL '5 minutes'
);
-- 예상: 3 (품목 수와 동일)
```

---

### 테스트 2: 입고 트랜잭션 (중간 실패 → 전체 롤백)

#### 준비
1. 입고 관리 페이지 접속
2. 3개 품목 입력:
   - 품목 1: 정상 데이터
   - 품목 2: **수량 0 입력** (검증 실패)
   - 품목 3: 정상 데이터

#### 실행
1. "저장" 버튼 클릭
2. 에러 메시지 확인: "수량은 0보다 커야 합니다"

#### 검증
```sql
-- 품목 1, 3도 저장 안되었는지 확인
SELECT COUNT(*) 
FROM purchases 
WHERE created_at > NOW() - INTERVAL '1 minute';
-- 예상: 0 (전체 롤백됨)
```

---

### 테스트 3: 판매 FIFO + 재고 부족 롤백

#### 준비
1. 테스트 품목의 현재 재고 확인 (예: 10개)
2. 판매 관리 페이지 접속
3. 2개 품목 입력:
   - 품목 A: 수량 5 (재고 충분)
   - 품목 B: 수량 **999** (재고 부족)

#### 실행
1. "저장" 버튼 클릭
2. 에러 메시지: "재고 부족: 품목 B (필요: 999, 재고: X)"

#### 검증
```sql
-- 1. 판매 레코드 없는지 확인
SELECT COUNT(*) 
FROM sales 
WHERE created_at > NOW() - INTERVAL '1 minute';
-- 예상: 0

-- 2. 품목 A의 재고도 그대로인지 확인
SELECT SUM(remaining_quantity) AS stock
FROM inventory_layers
WHERE product_id = '품목A_UUID' AND branch_id = '지점_UUID';
-- 예상: 10 (그대로 유지)
```

---

### 테스트 4: 거래번호 자동 생성

#### 실행
1. 입고 2번 저장 (reference_number 비우기)
2. 판매 1번 저장 (reference_number 비우기)

#### 검증
```sql
-- 생성된 거래번호 확인
SELECT reference_number, created_at 
FROM purchases 
WHERE purchase_date = CURRENT_DATE 
ORDER BY created_at DESC 
LIMIT 3;
-- 예상:
-- B01-20250126-PUR-002
-- B01-20250126-PUR-001

SELECT reference_number 
FROM sales 
WHERE sale_date = CURRENT_DATE 
ORDER BY created_at DESC 
LIMIT 1;
-- 예상: B01-20250126-SAL-001
```

---

### 테스트 5: 권한 검증 (타 지점 접근 차단)

#### 준비
- 사용자 B01 지점 소속 (시스템 관리자 아님)

#### 실행
1. 입고 페이지에서 **B02 지점** 선택 시도
2. 저장 버튼 클릭

#### 예상 결과
```
❌ 에러 메시지: "권한 없음: 본인 지점(B01)만 입력 가능합니다."
```

#### 검증
```sql
-- B02 지점에 데이터 생성 안되었는지 확인
SELECT COUNT(*) 
FROM purchases 
WHERE branch_id = 'B02_UUID' 
  AND created_at > NOW() - INTERVAL '1 minute';
-- 예상: 0
```

---

## ✅ Phase 1 완료 체크리스트

### 데이터베이스
- [ ] `database/phase1_batch_rpc_functions.sql` Supabase에 등록
- [ ] 3개 함수 존재 확인 (SQL 쿼리)
- [ ] 거래번호 생성 테스트 (예상 형식 일치)

### 애플리케이션
- [ ] 개발 서버 재시작
- [ ] 컴파일 에러 없음 확인
- [ ] TypeScript 타입 인식 확인

### 기능 테스트
- [ ] 테스트 1: 입고 전체 성공 (3개 품목)
- [ ] 테스트 2: 입고 중간 실패 → 전체 롤백
- [ ] 테스트 3: 판매 재고 부족 → 전체 롤백
- [ ] 테스트 4: 거래번호 자동 생성 (PUR-001, SAL-001)
- [ ] 테스트 5: 권한 검증 (타 지점 차단)

### 데이터 정합성
- [ ] `check_inventory_integrity()` 실행 → 0건 이슈
- [ ] `check_orphan_records()` 실행 → 0건 이슈
- [ ] `check_negative_inventory()` 실행 → 0건 이슈

---

## 🚨 알려진 제한 사항

### 1. 기존 데이터 거래번호 없음
- **문제**: Phase 1 이전 데이터는 `reference_number`가 NULL 또는 수동 입력
- **해결**: Phase 6 (마이그레이션)에서 거래 그룹화 후 번호 부여 예정

### 2. 거래 수정/삭제 기능 없음
- **문제**: 현재는 신규 입고/판매만 트랜잭션 적용
- **해결**: Phase 3 (Audit Log) 이후 수정/삭제 기능 추가 예정

### 3. 거래번호 동시 요청 시 드물게 중복 가능
- **문제**: `FOR UPDATE` 락이 있지만 극히 드문 경우 동시 생성 가능
- **해결**: 중복 발생 시 RPC 함수가 에러 반환 → 재시도

---

## 📞 다음 단계

Phase 1 테스트 완료 후:
1. 테스트 결과 리포트 (성공/실패 스크린샷)
2. 데이터 정합성 검증 결과
3. Phase 2 (권한 시스템 강화) 시작 승인 요청

**Phase 2 미리보기:**
- 사용자(0003) 역할 삭제 권한 제거
- 모든 RPC 함수에 지점 격리 검증 추가
- UI 조건부 렌더링 (권한별 버튼 표시)
