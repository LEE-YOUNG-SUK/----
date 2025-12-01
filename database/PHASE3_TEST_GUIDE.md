# Phase 3-6: Audit Log 시스템 통합 테스트 가이드

## 테스트 목적
Phase 3에서 구축한 Audit Log 시스템의 전체 기능을 검증합니다.

## 사전 준비

### 1. 데이터베이스 배포 확인
다음 SQL 파일들이 Supabase에 배포되었는지 확인:

- ✅ `phase3_audit_log_schema.sql` - audit_logs 테이블
- ✅ `phase3_audit_triggers.sql` - 트리거 함수 및 트리거
- ✅ `phase3_exec_sql_helper.sql` - exec_sql 헬퍼 함수
- ✅ `phase3_audit_rpc_functions.sql` - 조회용 RPC 함수

### 2. 시스템 상태 확인
Supabase SQL Editor에서 실행:

```sql
-- 트리거 확인
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname IN ('audit_purchases_trigger', 'audit_sales_trigger');

-- RPC 함수 확인
SELECT proname FROM pg_proc 
WHERE proname IN ('get_audit_logs', 'get_record_history', 'exec_sql');
```

## 테스트 시나리오

### 테스트 케이스 1: 입고 수정 → audit_logs 기록 확인

**단계:**
1. 입고 관리 페이지에서 새 입고 등록
2. 방금 등록한 입고의 "수량" 또는 "메모" 수정
3. Supabase에서 audit_logs 확인

**검증 SQL:**
```sql
-- 최근 입고 관련 로그 조회
SELECT 
  id,
  action,
  username,
  user_role,
  branch_name,
  changed_fields,
  created_at
FROM audit_logs
WHERE table_name = 'purchases'
ORDER BY created_at DESC
LIMIT 5;
```

**예상 결과:**
- ✅ action = 'UPDATE'
- ✅ username이 현재 로그인 사용자
- ✅ changed_fields 배열에 수정한 필드명 포함
- ✅ old_data/new_data에 변경 전/후 값 저장

---

### 테스트 케이스 2: 판매 삭제 → audit_logs 기록 확인

**단계:**
1. 판매 관리 페이지에서 새 판매 등록
2. 방금 등록한 판매 삭제 (원장/매니저/관리자만 가능)
3. Supabase에서 audit_logs 확인

**검증 SQL:**
```sql
-- 최근 판매 관련 로그 조회
SELECT 
  id,
  action,
  username,
  old_data->>'product_id' AS product_id,
  old_data->>'quantity' AS quantity,
  old_data->>'total_price' AS total_price,
  created_at
FROM audit_logs
WHERE table_name = 'sales' AND action = 'DELETE'
ORDER BY created_at DESC
LIMIT 5;
```

**예상 결과:**
- ✅ action = 'DELETE'
- ✅ old_data에 삭제된 데이터 전체 저장
- ✅ new_data는 NULL
- ✅ changed_fields는 NULL

---

### 테스트 케이스 3: 사용자 컨텍스트 검증

**단계:**
1. 서로 다른 사용자로 로그인 (예: 원장A, 원장B)
2. 각각 입고/판매 수정 수행
3. audit_logs에서 사용자 구분 확인

**검증 SQL:**
```sql
-- 사용자별 활동 확인
SELECT 
  username,
  user_role,
  branch_name,
  COUNT(*) AS total_actions,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes
FROM audit_logs
GROUP BY username, user_role, branch_name
ORDER BY total_actions DESC;
```

**예상 결과:**
- ✅ 각 사용자별로 활동 구분
- ✅ user_role이 올바르게 기록 (0000, 0001, 0002 등)
- ✅ branch_name이 사용자 지점과 일치

---

### 테스트 케이스 4: 권한별 조회 테스트

**단계:**
1. **원장(0001) 계정**: `/admin/audit-logs` 접근 → 조회 성공
2. **매니저(0002) 계정**: `/admin/audit-logs` 접근 → 메뉴 미표시 또는 403
3. **관리자(0000) 계정**: `/admin/audit-logs` 접근 → 전체 조회 성공

**예상 결과:**
- ✅ 원장: 본인 지점 데이터만 조회
- ✅ 매니저: 메뉴 자체가 표시 안 됨 (권한 없음)
- ✅ 관리자: 전체 지점 데이터 조회

---

### 테스트 케이스 5: 지점 격리 검증

**단계:**
1. A지점 원장으로 로그인
2. `/admin/audit-logs`에서 감사 로그 조회
3. B지점 데이터가 표시되지 않는지 확인

**검증 SQL:**
```sql
-- A지점 원장 시뮬레이션 (실제 UUID로 교체)
SELECT 
  id,
  table_name,
  action,
  branch_name,
  username,
  created_at
FROM get_audit_logs(
  p_user_id := 'branch-a-director-uuid'::UUID,
  p_user_role := '0001',
  p_user_branch_id := 'branch-a-uuid'::UUID
);
```

**예상 결과:**
- ✅ branch_name이 A지점만 표시
- ✅ B지점 데이터 표시 안 됨
- ✅ NULL branch (시스템 사용자)는 표시 가능

---

### 테스트 케이스 6: UI 필터링 기능

**단계:**
1. `/admin/audit-logs` 페이지 접근
2. 필터 적용:
   - 테이블: "입고(purchases)"
   - 액션: "수정(UPDATE)"
   - 날짜: 오늘
3. 조회 버튼 클릭

**예상 결과:**
- ✅ 입고 테이블의 수정 로그만 표시
- ✅ 통계 카드 수치 업데이트
- ✅ 테이블에 필터링된 결과만 표시

---

### 테스트 케이스 7: 상세 모달 - 변경 이력 조회

**단계:**
1. 감사 로그 테이블에서 "🔍 상세" 버튼 클릭
2. 레코드 변경 이력 모달 확인
3. 좌측 이력 목록에서 다른 이력 선택

**예상 결과:**
- ✅ 레코드의 전체 변경 이력 표시
- ✅ UPDATE: 변경된 필드별로 이전/변경 값 비교 표시
- ✅ DELETE: 삭제된 데이터 전체 표시
- ✅ JSONB 데이터 올바르게 파싱

---

### 테스트 케이스 8: 통계 카드 정확도

**단계:**
1. `/admin/audit-logs` 페이지 접근
2. 상단 통계 카드 수치 확인
3. SQL로 직접 집계한 값과 비교

**검증 SQL:**
```sql
-- 통계 검증
SELECT 
  COUNT(*) AS total_logs,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes,
  COUNT(DISTINCT user_id) AS unique_users
FROM audit_logs;
```

**예상 결과:**
- ✅ 전체 로그 수 일치
- ✅ 수정/삭제 건수 일치
- ✅ 활동 사용자 수 일치

---

## 성능 테스트

### 1000건 제한 확인
```sql
-- RPC 함수가 최대 1000건만 반환하는지 확인
SELECT COUNT(*) FROM get_audit_logs(
  p_user_id := 'admin-uuid'::UUID,
  p_user_role := '0000',
  p_user_branch_id := NULL
);
-- 결과: <= 1000
```

### 인덱스 사용 확인
```sql
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'purchases'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;
-- Index Scan을 사용하는지 확인
```

---

## 체크리스트

### 데이터베이스
- [ ] audit_logs 테이블 존재
- [ ] 트리거 2개 활성화 (purchases, sales)
- [ ] RPC 함수 8개 존재
- [ ] 인덱스 7개 생성

### 기능 검증
- [ ] 입고 수정 시 audit_logs 기록
- [ ] 판매 삭제 시 audit_logs 기록
- [ ] changed_fields 정확히 계산
- [ ] old_data/new_data JSONB 올바르게 저장
- [ ] user_id, username, user_role 정확히 기록
- [ ] branch_id, branch_name 정확히 기록

### 권한 시스템
- [ ] 원장(0001) 조회 가능
- [ ] 매니저(0002) 조회 불가 (메뉴 미표시)
- [ ] 지점 격리 정상 작동
- [ ] 시스템 관리자 전체 조회 가능

### UI 검증
- [ ] `/admin/audit-logs` 페이지 정상 렌더링
- [ ] 필터 기능 정상 작동
- [ ] 통계 카드 정확한 수치
- [ ] 테이블 정상 렌더링
- [ ] 상세 모달 정상 작동
- [ ] 변경 이력 비교 기능 정상

### 성능
- [ ] 1000건 제한 적용
- [ ] 인덱스 사용 확인
- [ ] 페이지 로딩 시간 < 3초

---

## 문제 해결

### 문제 1: audit_logs에 레코드가 생성되지 않음
**원인:** Server Actions에서 set_config 미실행  
**해결:** `exec_sql` 함수 배포 확인, Server Actions 코드 확인

### 문제 2: username이 'system'으로 표시
**원인:** set_config가 실행되지 않았거나 user_id가 잘못됨  
**해결:** Server Actions의 `data.created_by` 값 확인

### 문제 3: UI에서 "함수를 찾을 수 없음" 에러
**원인:** RPC 함수 미배포  
**해결:** `phase3_audit_rpc_functions.sql` 실행

### 문제 4: 매니저가 감사 로그 조회 가능
**원인:** 권한 설정 오류  
**해결:** `types/permissions.ts` 확인, 매니저에 audit_logs_view 권한 없어야 함

---

## 테스트 완료 보고

모든 테스트 케이스 통과 후:

```sql
-- 최종 상태 확인
SELECT 
  'Phase 3 Audit Log System' AS system,
  'COMPLETED' AS status,
  (SELECT COUNT(*) FROM audit_logs) AS total_logs,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'audit_%') AS active_triggers,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%audit%') AS audit_functions,
  CURRENT_TIMESTAMP AS verified_at;
```

**Phase 3 완료 조건:**
- ✅ 18개 체크리스트 항목 모두 통과
- ✅ 8개 테스트 케이스 모두 성공
- ✅ 성능 테스트 통과
- ✅ 문제 없이 프로덕션 배포 가능
