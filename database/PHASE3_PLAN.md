# Phase 3: Audit Log 시스템 구축

## 목표
모든 데이터 변경(수정/삭제)을 완전히 추적하여 데이터 무결성과 보안을 강화합니다.

---

## Phase 3-1: Audit Log 테이블 설계 ✅ (현재 단계)

### 구조
```sql
audit_logs
├── id (UUID)
├── table_name (TEXT) - 'purchases', 'sales', 'products', 'clients'
├── record_id (UUID) - 변경된 레코드 ID
├── action (TEXT) - 'UPDATE', 'DELETE', 'INSERT'
├── old_data (JSONB) - 변경 전 데이터
├── new_data (JSONB) - 변경 후 데이터
├── changed_fields (TEXT[]) - 변경된 필드 목록
├── user_id, username, user_role
├── branch_id, branch_name
└── created_at
```

### 인덱스 (8개)
1. `idx_audit_logs_table_name` - 테이블별 조회
2. `idx_audit_logs_record_id` - 레코드별 이력
3. `idx_audit_logs_user_id` - 사용자별 이력
4. `idx_audit_logs_branch_id` - 지점별 이력
5. `idx_audit_logs_action` - 작업 유형별
6. `idx_audit_logs_created_date` - 날짜별
7. `idx_audit_logs_branch_date` - 지점+날짜 복합
8. Primary Key on `id`

### 헬퍼 함수
- `get_changed_fields(old_data, new_data)` - JSONB 비교하여 변경 필드 추출

### 배포
```bash
# Supabase SQL Editor에서 실행
database/phase3_audit_log_schema.sql
```

---

## Phase 3-2: 트리거 생성 (다음 단계)

### 대상 테이블
1. **purchases** - 입고 수정/삭제
2. **sales** - 판매 수정/삭제
3. **products** - 품목 수정/삭제
4. **clients** - 거래처 수정/삭제

### 트리거 함수 패턴
```sql
CREATE OR REPLACE FUNCTION audit_purchases_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_user_role TEXT;
  v_branch_id UUID;
  v_branch_name TEXT;
BEGIN
  -- 현재 세션에서 사용자 정보 가져오기
  -- (Server Actions에서 set_config로 설정)
  v_user_id := current_setting('app.current_user_id', true)::UUID;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name, record_id, action,
      old_data, new_data, changed_fields,
      user_id, username, user_role,
      branch_id, branch_name
    ) VALUES (
      'purchases', OLD.id, 'DELETE',
      row_to_json(OLD)::JSONB, NULL, NULL,
      v_user_id, v_username, v_user_role,
      OLD.branch_id, v_branch_name
    );
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name, record_id, action,
      old_data, new_data, changed_fields,
      user_id, username, user_role,
      branch_id, branch_name
    ) VALUES (
      'purchases', NEW.id, 'UPDATE',
      row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB,
      get_changed_fields(row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB),
      v_user_id, v_username, v_user_role,
      NEW.branch_id, v_branch_name
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_purchases_trigger
AFTER UPDATE OR DELETE ON purchases
FOR EACH ROW EXECUTE FUNCTION audit_purchases_changes();
```

### 주의사항
- Server Actions에서 `set_config('app.current_user_id', user_id, false)` 호출 필요
- 트리거는 `AFTER` 사용 (데이터 변경 후 로깅)
- `SECURITY DEFINER` 사용 (권한 문제 방지)

---

## Phase 3-3: RPC 함수 생성

### 1. get_audit_logs (감사 로그 조회)
```sql
CREATE FUNCTION get_audit_logs(
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_current_user_id UUID DEFAULT NULL  -- 권한 검증용
)
RETURNS TABLE (...)
```

**권한 검증**:
- 시스템 관리자(0000): 전체 로그 조회 가능
- 원장/매니저(0001/0002): 본인 지점 로그만 조회
- 사용자(0003): 본인 작업 로그만 조회

### 2. get_record_history (특정 레코드 이력)
```sql
CREATE FUNCTION get_record_history(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS TABLE (...)
```

---

## Phase 3-4: UI 구현

### 1. 감사 로그 페이지 (`app/admin/audit-logs/page.tsx`)
- **접근 권한**: 원장(0001) 이상
- **기능**:
  - 테이블별 필터 (purchases, sales, products, clients)
  - 작업 유형 필터 (UPDATE, DELETE)
  - 날짜 범위 필터
  - 사용자 필터
  - 지점 필터 (시스템 관리자만)
  
### 2. 레코드별 이력 모달 (`components/audit/RecordHistoryModal.tsx`)
- 입고/판매 상세 페이지에서 "변경 이력" 버튼 클릭
- 해당 레코드의 모든 변경 이력 표시
- Before/After 비교 UI

### 3. AG Grid 설정
```typescript
const columnDefs = [
  { field: 'created_at', headerName: '변경일시' },
  { field: 'action', headerName: '작업' }, // UPDATE/DELETE
  { field: 'username', headerName: '작업자' },
  { field: 'branch_name', headerName: '지점' },
  { field: 'changed_fields', headerName: '변경 필드' },
  { field: 'old_data', headerName: '이전 값', cellRenderer: JsonDiffRenderer },
  { field: 'new_data', headerName: '변경 후', cellRenderer: JsonDiffRenderer }
]
```

---

## Phase 3-5: Server Actions 수정

### 기존 Server Actions에 사용자 컨텍스트 추가

**수정 대상**:
- `app/purchases/actions.ts` - `savePurchases()`, `deletePurchase()`
- `app/sales/actions.ts` - `saveSales()`, `deleteSale()`
- `app/products/actions.ts` - `updateProduct()`, `deleteProduct()`
- `app/clients/actions.ts` - `updateClient()`, `deleteClient()`

**패턴**:
```typescript
export async function savePurchases(items: PurchaseItem[], userId: string) {
  const supabase = await createServerClient()
  
  // 1. 사용자 컨텍스트 설정
  await supabase.rpc('set_audit_context', {
    p_user_id: userId
  })
  
  // 2. 기존 로직 실행
  const { data, error } = await supabase.rpc('process_batch_purchase', {
    ...
  })
  
  // 3. 트리거가 자동으로 audit_logs에 기록
  
  return { success: true, data }
}
```

---

## Phase 3-6: 테스트 시나리오

### 테스트 1: 입고 수정
1. 입고 내역 1건 생성
2. 수량 변경 (10 → 20)
3. `audit_logs` 확인:
   - `action = 'UPDATE'`
   - `changed_fields = ['quantity']`
   - `old_data.quantity = 10`
   - `new_data.quantity = 20`

### 테스트 2: 판매 삭제
1. 판매 내역 1건 생성
2. 삭제
3. `audit_logs` 확인:
   - `action = 'DELETE'`
   - `old_data` 전체 레코드 기록
   - `new_data = NULL`

### 테스트 3: 권한 검증
1. 사용자(0003)로 로그인
2. `/admin/audit-logs` 접속 시도
3. 예상: 본인 작업 로그만 표시

### 테스트 4: UI 이력 조회
1. 입고 상세 페이지 접속
2. "변경 이력" 버튼 클릭
3. 모달에서 Before/After 비교

---

## 데이터 보존 정책 (선택)

### 옵션 1: 무제한 보존
- 모든 로그 영구 보존
- 장점: 완전한 감사 추적
- 단점: 스토리지 증가

### 옵션 2: 정기 삭제
```sql
-- 1년 이상 된 로그 삭제 (월별 배치)
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

### 옵션 3: 파티셔닝
- `created_date`로 월별 파티션
- 오래된 파티션 아카이브

---

## 보안 고려사항

1. **민감 정보 마스킹**
   - `old_data`, `new_data`에서 민감 정보 제외
   - 예: 비밀번호, 개인정보 등

2. **로그 변조 방지**
   - `audit_logs` 테이블은 INSERT만 허용
   - UPDATE/DELETE 금지 (RLS 또는 권한 제어)

3. **접근 제어**
   - 원장(0001) 이상만 조회 가능
   - 사용자는 본인 로그만 조회

---

## 성능 최적화

1. **인덱스 활용**
   - 날짜 범위 조회: `idx_audit_logs_created_date`
   - 지점별 조회: `idx_audit_logs_branch_date`

2. **JSONB GIN 인덱스** (선택)
   ```sql
   CREATE INDEX idx_audit_logs_old_data_gin ON audit_logs USING GIN (old_data);
   CREATE INDEX idx_audit_logs_new_data_gin ON audit_logs USING GIN (new_data);
   ```

3. **LIMIT 필수**
   - 로그 조회 시 항상 LIMIT 적용 (기본 100건)

---

## 현재 진행 상황

- ✅ **Phase 3-1 완료**: `phase3_audit_log_schema.sql` 생성
- ⏳ **다음**: Supabase SQL Editor에서 스키마 실행
- 📋 **대기**: Phase 3-2 트리거 생성

---

## 배포 순서

1. **Phase 3-1 배포** (지금)
   ```sql
   -- Supabase SQL Editor
   -- phase3_audit_log_schema.sql 실행
   ```

2. **검증**
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'audit_logs';
   SELECT * FROM pg_indexes WHERE tablename = 'audit_logs';
   ```

3. **Phase 3-2 준비**
   - 트리거 함수 작성
   - 4개 테이블에 트리거 연결

사용자 확인 후 Phase 3-2 진행합니다!
