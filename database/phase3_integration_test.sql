-- =====================================================
-- Phase 3-6: 통합 테스트 시나리오
-- =====================================================
-- 목적: Audit Log 시스템 전체 기능 검증
-- 실행 순서: 1. 사전 준비 → 2. 테스트 실행 → 3. 검증

-- =====================================================
-- 1. 사전 준비: 시스템 상태 확인
-- =====================================================

-- 1-1. audit_logs 테이블 존재 확인
SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE tablename = 'audit_logs';

-- 1-2. 트리거 활성화 확인
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END AS status,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname IN ('audit_purchases_trigger', 'audit_sales_trigger')
ORDER BY c.relname;

-- 1-3. RPC 함수 존재 확인
SELECT 
  proname AS function_name,
  pronargs AS argument_count
FROM pg_proc
WHERE proname IN (
  'get_current_audit_user',
  'audit_purchases_changes',
  'audit_sales_changes',
  'get_audit_logs',
  'get_record_history',
  'get_audit_stats',
  'get_user_activity',
  'exec_sql'
)
ORDER BY proname;

-- 1-4. 현재 audit_logs 상태
SELECT 
  COUNT(*) AS total_logs,
  COUNT(CASE WHEN table_name = 'purchases' THEN 1 END) AS purchases_logs,
  COUNT(CASE WHEN table_name = 'sales' THEN 1 END) AS sales_logs,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes,
  MIN(created_at) AS first_log,
  MAX(created_at) AS last_log
FROM audit_logs;

-- =====================================================
-- 2. 테스트 시나리오 실행
-- =====================================================

-- 📝 이 섹션은 UI에서 수행하고, SQL로 결과 검증
-- 
-- 테스트 케이스:
-- [TC-1] 입고 저장 → 수정 → audit_logs 확인
-- [TC-2] 판매 저장 → 삭제 → audit_logs 확인
-- [TC-3] 사용자 컨텍스트 검증
-- [TC-4] 권한별 조회 검증
-- [TC-5] 지점 격리 검증

-- =====================================================
-- 3. 검증 쿼리
-- =====================================================

-- [검증 3-1] 최근 audit_logs 조회 (전체)
SELECT 
  id,
  table_name,
  action,
  username,
  user_role,
  branch_name,
  changed_fields,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- [검증 3-2] 입고(purchases) 관련 로그
SELECT 
  id,
  record_id,
  action,
  username,
  user_role,
  branch_name,
  changed_fields,
  jsonb_object_keys(old_data) AS old_data_fields,
  jsonb_object_keys(new_data) AS new_data_fields,
  created_at
FROM audit_logs
WHERE table_name = 'purchases'
ORDER BY created_at DESC
LIMIT 10;

-- [검증 3-3] 판매(sales) 관련 로그
SELECT 
  id,
  record_id,
  action,
  username,
  user_role,
  branch_name,
  changed_fields,
  created_at
FROM audit_logs
WHERE table_name = 'sales'
ORDER BY created_at DESC
LIMIT 10;

-- [검증 3-4] UPDATE 액션만 조회 (changed_fields 확인)
SELECT 
  id,
  table_name,
  record_id,
  action,
  username,
  changed_fields,
  array_length(changed_fields, 1) AS changed_count,
  created_at
FROM audit_logs
WHERE action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 10;

-- [검증 3-5] DELETE 액션만 조회 (old_data 확인)
SELECT 
  id,
  table_name,
  record_id,
  action,
  username,
  old_data->>'product_id' AS product_id,
  old_data->>'quantity' AS quantity,
  old_data->>'total_price' AS total_price,
  created_at
FROM audit_logs
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 10;

-- [검증 3-6] 사용자별 활동 통계
SELECT 
  username,
  user_role,
  branch_name,
  COUNT(*) AS total_actions,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes,
  MIN(created_at) AS first_action,
  MAX(created_at) AS last_action
FROM audit_logs
GROUP BY username, user_role, branch_name
ORDER BY total_actions DESC;

-- [검증 3-7] 테이블별 액션 분포
SELECT 
  table_name,
  action,
  COUNT(*) AS count,
  COUNT(DISTINCT user_id) AS unique_users,
  MIN(created_at) AS first_occurrence,
  MAX(created_at) AS last_occurrence
FROM audit_logs
GROUP BY table_name, action
ORDER BY table_name, action;

-- [검증 3-8] JSONB 데이터 무결성 확인
SELECT 
  id,
  table_name,
  action,
  CASE 
    WHEN old_data IS NULL THEN 'NULL'
    ELSE jsonb_typeof(old_data)
  END AS old_data_type,
  CASE 
    WHEN new_data IS NULL THEN 'NULL'
    ELSE jsonb_typeof(new_data)
  END AS new_data_type,
  array_length(changed_fields, 1) AS changed_count,
  CASE 
    WHEN action = 'UPDATE' AND changed_fields IS NULL THEN 'ERROR: NULL changed_fields'
    WHEN action = 'UPDATE' AND array_length(changed_fields, 1) = 0 THEN 'WARNING: Empty changed_fields'
    WHEN action = 'DELETE' AND old_data IS NULL THEN 'ERROR: NULL old_data'
    ELSE 'OK'
  END AS validation_status,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- [검증 3-9] 사용자 정보 누락 확인
SELECT 
  COUNT(*) AS total,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) AS null_user_id,
  COUNT(CASE WHEN username IS NULL OR username = '' THEN 1 END) AS null_username,
  COUNT(CASE WHEN user_role IS NULL OR user_role = '' THEN 1 END) AS null_user_role,
  COUNT(CASE WHEN username = 'system' THEN 1 END) AS system_user_count
FROM audit_logs;

-- [검증 3-10] 특정 레코드 변경 이력 추적
-- 사용법: record_id를 실제 UUID로 교체
-- 
-- SELECT 
--   id,
--   action,
--   username,
--   user_role,
--   branch_name,
--   changed_fields,
--   old_data,
--   new_data,
--   created_at
-- FROM audit_logs
-- WHERE record_id = 'your-purchase-or-sale-id'::UUID
-- ORDER BY created_at DESC;

-- =====================================================
-- 4. RPC 함수 테스트
-- =====================================================

-- [RPC 테스트 4-1] get_audit_logs 기본 조회
-- 실제 user_id, role, branch_id로 교체 필요
-- 
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'your-user-uuid'::UUID,
--   p_user_role := '0001',  -- 원장
--   p_user_branch_id := 'your-branch-uuid'::UUID
-- )
-- LIMIT 10;

-- [RPC 테스트 4-2] get_audit_logs 필터링
-- 입고(purchases) UPDATE만 조회
-- 
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'your-user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'your-branch-uuid'::UUID,
--   p_table_name := 'purchases',
--   p_action := 'UPDATE',
--   p_start_date := CURRENT_DATE - INTERVAL '7 days',
--   p_end_date := CURRENT_DATE
-- );

-- [RPC 테스트 4-3] get_record_history
-- 특정 레코드의 전체 변경 이력
-- 
-- SELECT * FROM get_record_history(
--   p_user_id := 'your-user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'your-branch-uuid'::UUID,
--   p_record_id := 'your-record-uuid'::UUID,
--   p_table_name := 'purchases'
-- );

-- [RPC 테스트 4-4] get_audit_stats
-- 감사 로그 통계
-- 
-- SELECT * FROM get_audit_stats(
--   p_user_id := 'your-user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'your-branch-uuid'::UUID,
--   p_start_date := CURRENT_DATE - INTERVAL '30 days',
--   p_end_date := CURRENT_DATE
-- );

-- [RPC 테스트 4-5] get_user_activity
-- 사용자 활동 통계
-- 
-- SELECT * FROM get_user_activity(
--   p_user_id := 'your-user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'your-branch-uuid'::UUID,
--   p_start_date := CURRENT_DATE - INTERVAL '30 days',
--   p_end_date := CURRENT_DATE
-- );

-- =====================================================
-- 5. 권한 테스트
-- =====================================================

-- [권한 테스트 5-1] 매니저(0002) 조회 시도 (실패해야 함)
-- 
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'manager-user-uuid'::UUID,
--   p_user_role := '0002',  -- 매니저 (권한 없음)
--   p_user_branch_id := 'branch-uuid'::UUID
-- );
-- 
-- 예상 결과: ERROR: 감사 로그 조회 권한이 없습니다. (원장 이상 필요)

-- [권한 테스트 5-2] 사용자(0003) 조회 시도 (실패해야 함)
-- 
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0003',  -- 사용자 (권한 없음)
--   p_user_branch_id := 'branch-uuid'::UUID
-- );
-- 
-- 예상 결과: ERROR: 감사 로그 조회 권한이 없습니다. (원장 이상 필요)

-- =====================================================
-- 6. 지점 격리 테스트
-- =====================================================

-- [지점 격리 6-1] A지점 원장이 조회
-- 결과: A지점 데이터만 반환되어야 함
-- 
-- SELECT 
--   id,
--   table_name,
--   action,
--   branch_name,
--   username,
--   created_at
-- FROM get_audit_logs(
--   p_user_id := 'branch-a-director-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-a-uuid'::UUID
-- );

-- [지점 격리 6-2] 시스템 관리자 조회
-- 결과: 전체 지점 데이터 반환되어야 함
-- 
-- SELECT 
--   id,
--   table_name,
--   action,
--   branch_name,
--   username,
--   created_at
-- FROM get_audit_logs(
--   p_user_id := 'admin-uuid'::UUID,
--   p_user_role := '0000',
--   p_user_branch_id := NULL
-- );

-- =====================================================
-- 7. 성능 테스트
-- =====================================================

-- [성능 7-1] 1000건 제한 확인
SELECT 
  'Max 1000 records limit test' AS test_name,
  COUNT(*) AS returned_count,
  CASE 
    WHEN COUNT(*) <= 1000 THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM (
  SELECT * FROM audit_logs
  LIMIT 1001
) sub;

-- [성능 7-2] 인덱스 사용 확인
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'purchases'
  AND action = 'UPDATE'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- =====================================================
-- 8. 테스트 결과 요약
-- =====================================================

-- 전체 테스트 요약
SELECT 
  'Phase 3 Audit Log System Test Summary' AS title,
  (SELECT COUNT(*) FROM audit_logs) AS total_logs,
  (SELECT COUNT(*) FROM audit_logs WHERE action = 'UPDATE') AS total_updates,
  (SELECT COUNT(*) FROM audit_logs WHERE action = 'DELETE') AS total_deletes,
  (SELECT COUNT(DISTINCT user_id) FROM audit_logs) AS unique_users,
  (SELECT COUNT(DISTINCT branch_id) FROM audit_logs WHERE branch_id IS NOT NULL) AS unique_branches,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('audit_purchases_trigger', 'audit_sales_trigger')) AS active_triggers,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'get_audit%' OR proname LIKE 'audit_%') AS audit_functions;

-- =====================================================
-- Phase 3-6 테스트 체크리스트
-- =====================================================
-- 
-- [ ] audit_logs 테이블 존재
-- [ ] 트리거 2개 활성화 (purchases, sales)
-- [ ] RPC 함수 8개 존재
-- [ ] 입고 수정 시 audit_logs에 UPDATE 레코드 생성
-- [ ] 판매 삭제 시 audit_logs에 DELETE 레코드 생성
-- [ ] changed_fields 배열 정확히 계산
-- [ ] old_data/new_data JSONB 올바르게 저장
-- [ ] user_id, username, user_role 올바르게 기록
-- [ ] branch_id, branch_name 올바르게 기록
-- [ ] 원장(0001) 권한으로 조회 가능
-- [ ] 매니저(0002) 권한으로 조회 시 에러
-- [ ] 지점 격리 정상 작동 (원장)
-- [ ] 시스템 관리자 전체 조회 가능
-- [ ] RPC 함수 필터링 정상 작동
-- [ ] 1000건 제한 적용
-- [ ] UI에서 조회 정상 작동
-- [ ] 상세 모달 정상 작동
-- [ ] 통계 카드 정확한 수치 표시
