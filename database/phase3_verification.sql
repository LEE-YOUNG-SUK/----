-- =====================================================
-- Phase 3-3: Server Actions 수정 검증 및 테스트
-- =====================================================

-- 1. exec_sql 함수 확인
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'exec_sql';

-- 2. 트리거 활성화 상태 확인
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  t.tgenabled AS enabled,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname IN ('audit_purchases_trigger', 'audit_sales_trigger')
ORDER BY c.relname;

-- 3. audit_logs 테이블 현재 상태
SELECT 
  COUNT(*) AS total_logs,
  COUNT(DISTINCT table_name) AS tables_logged,
  MIN(created_at) AS first_log,
  MAX(created_at) AS last_log
FROM audit_logs;

-- =====================================================
-- 테스트 시나리오 1: 입고 수정 (UPDATE)
-- =====================================================
-- 준비: 임시 입고 데이터 생성 (실제 환경에서는 UI에서 수행)
-- 
-- 1단계: 입고 생성
-- - UI에서 입고 저장 (savePurchases 호출)
-- - Server Actions가 set_config('app.current_user_id', userId) 실행
-- - process_batch_purchase RPC 호출
-- 
-- 2단계: 입고 수정 (UPDATE 트리거 발동)
-- UPDATE purchases
-- SET notes = '수정된 메모'
-- WHERE id = 'your-purchase-id'::UUID;
-- 
-- 3단계: audit_logs 확인
-- SELECT 
--   id,
--   table_name,
--   action,
--   username,
--   user_role,
--   branch_name,
--   changed_fields,
--   old_data->>'notes' AS old_notes,
--   new_data->>'notes' AS new_notes,
--   created_at
-- FROM audit_logs
-- WHERE table_name = 'purchases'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- =====================================================
-- 테스트 시나리오 2: 판매 삭제 (DELETE)
-- =====================================================
-- 1단계: 판매 생성 (UI에서 수행)
-- 
-- 2단계: 판매 삭제 (DELETE 트리거 발동)
-- DELETE FROM sales
-- WHERE id = 'your-sale-id'::UUID;
-- 
-- 3단계: audit_logs 확인
-- SELECT 
--   id,
--   table_name,
--   action,
--   username,
--   user_role,
--   branch_name,
--   old_data->>'product_id' AS product_id,
--   old_data->>'quantity' AS quantity,
--   old_data->>'total_price' AS total_price,
--   created_at
-- FROM audit_logs
-- WHERE table_name = 'sales' AND action = 'DELETE'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- =====================================================
-- 테스트 시나리오 3: 사용자 컨텍스트 검증
-- =====================================================
-- 목적: Server Actions가 set_config를 제대로 호출했는지 확인
-- 
-- 1단계: set_config 직접 테스트
-- SELECT exec_sql('SELECT set_config(''app.current_user_id'', ''test-user-uuid'', false)');
-- 
-- 2단계: 현재 설정값 확인
-- SELECT current_setting('app.current_user_id', true);
-- 
-- 3단계: get_current_audit_user 함수 테스트
-- SELECT * FROM get_current_audit_user();

-- =====================================================
-- 최근 audit_logs 조회 (모든 테이블)
-- =====================================================
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

-- =====================================================
-- 특정 레코드 변경 이력 조회
-- =====================================================
-- 사용법: record_id를 실제 UUID로 교체
-- SELECT 
--   id,
--   action,
--   username,
--   user_role,
--   changed_fields,
--   old_data,
--   new_data,
--   created_at
-- FROM audit_logs
-- WHERE record_id = 'your-record-uuid'::UUID
-- ORDER BY created_at DESC;

-- =====================================================
-- 액션별 통계
-- =====================================================
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

-- =====================================================
-- 사용자별 활동 통계
-- =====================================================
SELECT 
  username,
  user_role,
  COUNT(*) AS total_actions,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes,
  MIN(created_at) AS first_action,
  MAX(created_at) AS last_action
FROM audit_logs
GROUP BY username, user_role
ORDER BY total_actions DESC;

-- =====================================================
-- Phase 3-3 검증 체크리스트
-- =====================================================
-- [ ] exec_sql 함수가 존재하는가?
-- [ ] purchases/sales 트리거가 활성화되어 있는가?
-- [ ] Server Actions 코드에 set_config 호출이 추가되었는가?
-- [ ] 입고 저장 시 audit_logs에 레코드가 생성되는가?
-- [ ] 판매 저장 시 audit_logs에 레코드가 생성되는가?
-- [ ] audit_logs의 username/user_role이 올바른가?
-- [ ] changed_fields 배열이 정확히 계산되는가?
-- [ ] old_data/new_data JSONB가 올바르게 저장되는가?
