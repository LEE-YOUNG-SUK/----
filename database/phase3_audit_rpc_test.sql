-- =====================================================
-- Phase 3-4: RPC 함수 검증 및 테스트
-- =====================================================

-- =====================================================
-- 1. RPC 함수 존재 확인
-- =====================================================
SELECT 
  proname AS function_name,
  pronargs AS argument_count,
  pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN (
  'get_audit_logs',
  'get_record_history',
  'get_audit_stats',
  'get_user_activity'
)
ORDER BY proname;

-- =====================================================
-- 2. 테스트 시나리오 1: get_audit_logs 기본 조회
-- =====================================================
-- 사용법: 실제 user_id, user_role, branch_id로 교체
-- 
-- 시스템 관리자 (전체 조회):
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'admin-uuid'::UUID,
--   p_user_role := '0000',
--   p_user_branch_id := NULL
-- );
-- 
-- 원장 (본인 지점만):
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID
-- );

-- =====================================================
-- 3. 테스트 시나리오 2: 필터 적용 조회
-- =====================================================
-- 입고(purchases) 테이블의 UPDATE만 조회:
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID,
--   p_table_name := 'purchases',
--   p_action := 'UPDATE'
-- );
-- 
-- 날짜 범위 필터:
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID,
--   p_start_date := '2025-01-01'::DATE,
--   p_end_date := '2025-01-31'::DATE
-- );

-- =====================================================
-- 4. 테스트 시나리오 3: get_record_history
-- =====================================================
-- 특정 입고 레코드의 변경 이력:
-- SELECT * FROM get_record_history(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID,
--   p_record_id := 'purchase-uuid'::UUID,
--   p_table_name := 'purchases'
-- );

-- =====================================================
-- 5. 테스트 시나리오 4: get_audit_stats
-- =====================================================
-- 감사 로그 통계:
-- SELECT * FROM get_audit_stats(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID,
--   p_start_date := '2025-01-01'::DATE,
--   p_end_date := CURRENT_DATE
-- );

-- =====================================================
-- 6. 테스트 시나리오 5: get_user_activity
-- =====================================================
-- 모든 사용자 활동:
-- SELECT * FROM get_user_activity(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID
-- );
-- 
-- 특정 사용자 활동:
-- SELECT * FROM get_user_activity(
--   p_user_id := 'user-uuid'::UUID,
--   p_user_role := '0001',
--   p_user_branch_id := 'branch-uuid'::UUID,
--   p_target_user_id := 'target-user-uuid'::UUID
-- );

-- =====================================================
-- 7. 권한 테스트
-- =====================================================
-- 매니저(0002) 권한으로 조회 시도 (실패해야 함):
-- SELECT * FROM get_audit_logs(
--   p_user_id := 'manager-uuid'::UUID,
--   p_user_role := '0002',
--   p_user_branch_id := 'branch-uuid'::UUID
-- );
-- 예상 결과: ERROR: 감사 로그 조회 권한이 없습니다. (원장 이상 필요)

-- =====================================================
-- 8. 지점 격리 테스트
-- =====================================================
-- 원장이 다른 지점 데이터 조회 시도:
-- 1. A지점 원장으로 로그인
-- 2. B지점의 audit_logs 조회 시도
-- 3. 결과: A지점 데이터만 반환되어야 함

-- =====================================================
-- 9. 성능 테스트
-- =====================================================
-- 1000건 제한 확인:
-- SELECT COUNT(*) FROM get_audit_logs(
--   p_user_id := 'admin-uuid'::UUID,
--   p_user_role := '0000',
--   p_user_branch_id := NULL
-- );
-- 결과: 최대 1000건

-- =====================================================
-- 10. 실제 데이터로 검증
-- =====================================================
-- 준비: 테스트용 audit_logs 데이터 생성
-- 1. 입고 저장 (UI에서 수행)
-- 2. 입고 수정 (UPDATE 트리거 발동)
-- 3. 판매 저장
-- 4. 판매 삭제 (DELETE 트리거 발동)

-- 검증 1: audit_logs에 4건 이상 존재
SELECT 
  COUNT(*) AS total_logs,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes
FROM audit_logs;

-- 검증 2: 테이블별 분포
SELECT 
  table_name,
  action,
  COUNT(*) AS count
FROM audit_logs
GROUP BY table_name, action
ORDER BY table_name, action;

-- 검증 3: 사용자 정보 누락 확인
SELECT 
  COUNT(*) AS total,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) AS null_user_id,
  COUNT(CASE WHEN username IS NULL THEN 1 END) AS null_username,
  COUNT(CASE WHEN user_role IS NULL THEN 1 END) AS null_user_role
FROM audit_logs;

-- 검증 4: JSONB 데이터 무결성
SELECT 
  id,
  table_name,
  action,
  jsonb_typeof(old_data) AS old_data_type,
  jsonb_typeof(new_data) AS new_data_type,
  array_length(changed_fields, 1) AS changed_count
FROM audit_logs
WHERE action = 'UPDATE'
LIMIT 10;

-- =====================================================
-- Phase 3-4 검증 체크리스트
-- =====================================================
-- [ ] get_audit_logs 함수가 존재하는가?
-- [ ] get_record_history 함수가 존재하는가?
-- [ ] get_audit_stats 함수가 존재하는가?
-- [ ] get_user_activity 함수가 존재하는가?
-- [ ] 원장(0001) 권한으로 조회 가능한가?
-- [ ] 매니저(0002) 권한으로 조회 시 에러 발생하는가?
-- [ ] 지점 격리가 정상 작동하는가?
-- [ ] 시스템 관리자는 전체 조회 가능한가?
-- [ ] 필터(테이블, 액션, 날짜)가 정상 작동하는가?
-- [ ] 1000건 제한이 적용되는가?
-- [ ] changed_fields 배열이 올바르게 반환되는가?
-- [ ] JSONB 데이터가 올바르게 반환되는가?

-- =====================================================
-- 다음 단계 준비 확인
-- =====================================================
SELECT 
  'Phase 3-4 완료: RPC 함수 생성' AS status,
  'Phase 3-5 시작: UI 구현 준비' AS next_step,
  '필요 컴포넌트: app/admin/audit-logs/page.tsx, AuditLogTable, AuditLogFilters, RecordHistoryModal' AS requirements;
