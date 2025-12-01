-- =====================================================
-- Phase 3 빠른 검증 (Quick Check)
-- =====================================================
-- 사용자가 수행한 UPDATE/DELETE 작업이 audit_logs에 정상 기록되었는지 확인

-- ✅ [체크 1] 최근 audit_logs 전체 조회 (가장 중요!)
SELECT 
  id,
  table_name,
  action,
  username,
  user_role,
  branch_name,
  changed_fields,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- ✅ [체크 2] UPDATE 액션 상세 확인
SELECT 
  id,
  table_name,
  record_id,
  action,
  username,
  changed_fields,
  array_length(changed_fields, 1) AS changed_count,
  old_data,
  new_data,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
WHERE action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 10;

-- ✅ [체크 3] DELETE 액션 상세 확인
SELECT 
  id,
  table_name,
  record_id,
  action,
  username,
  old_data->>'product_code' AS product_code,
  old_data->>'product_name' AS product_name,
  old_data->>'quantity' AS quantity,
  old_data->>'unit_price' AS unit_price,
  old_data->>'unit_cost' AS unit_cost,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 10;

-- ✅ [체크 4] 입고(purchases) 관련 로그
SELECT 
  id,
  record_id,
  action,
  username,
  branch_name,
  changed_fields,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
WHERE table_name = 'purchases'
ORDER BY created_at DESC
LIMIT 10;

-- ✅ [체크 5] 판매(sales) 관련 로그
SELECT 
  id,
  record_id,
  action,
  username,
  branch_name,
  changed_fields,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
WHERE table_name = 'sales'
ORDER BY created_at DESC
LIMIT 10;

-- ✅ [체크 6] 데이터 무결성 검증
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
    WHEN action = 'UPDATE' AND changed_fields IS NULL THEN '❌ ERROR: NULL changed_fields'
    WHEN action = 'UPDATE' AND array_length(changed_fields, 1) = 0 THEN '⚠️ WARNING: Empty changed_fields'
    WHEN action = 'DELETE' AND old_data IS NULL THEN '❌ ERROR: NULL old_data'
    WHEN action = 'UPDATE' AND (old_data IS NULL OR new_data IS NULL) THEN '❌ ERROR: Missing data'
    ELSE '✅ OK'
  END AS validation_status,
  created_at AT TIME ZONE 'Asia/Seoul' AS created_at_kst
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;

-- ✅ [체크 7] 사용자별 활동 통계
SELECT 
  username,
  user_role,
  branch_name,
  COUNT(*) AS total_actions,
  COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN action = 'DELETE' THEN 1 END) AS deletes,
  MIN(created_at AT TIME ZONE 'Asia/Seoul') AS first_action_kst,
  MAX(created_at AT TIME ZONE 'Asia/Seoul') AS last_action_kst
FROM audit_logs
GROUP BY username, user_role, branch_name
ORDER BY total_actions DESC;

-- ✅ [체크 8] 전체 시스템 요약
SELECT 
  '📊 Phase 3 Audit Log System Status' AS title,
  (SELECT COUNT(*) FROM audit_logs) AS total_logs,
  (SELECT COUNT(*) FROM audit_logs WHERE action = 'UPDATE') AS total_updates,
  (SELECT COUNT(*) FROM audit_logs WHERE action = 'DELETE') AS total_deletes,
  (SELECT COUNT(DISTINCT user_id) FROM audit_logs) AS unique_users,
  (SELECT COUNT(DISTINCT branch_id) FROM audit_logs WHERE branch_id IS NOT NULL) AS unique_branches,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('audit_purchases_trigger', 'audit_sales_trigger') AND tgenabled = 'O') AS active_triggers;

-- =====================================================
-- 예상 결과:
-- =====================================================
-- [체크 1] 최근 로그에서 UPDATE/DELETE 레코드 확인 가능
-- [체크 2] changed_fields에 ["quantity", "unit_price"] 등 변경된 필드 목록
-- [체크 3] old_data에 삭제 전 데이터 완전히 보존
-- [체크 4,5] purchases/sales 별로 로그 분리 확인
-- [체크 6] 모든 레코드가 '✅ OK' 상태
-- [체크 7] 사용자별로 UPDATE/DELETE 횟수 집계
-- [체크 8] active_triggers = 2 (purchases, sales)
