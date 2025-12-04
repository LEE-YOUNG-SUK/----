-- =====================================================
-- Audit Log RPC 함수 수정: old_data, new_data 추가
-- =====================================================

-- 1. 감사 로그 목록 조회 함수 수정
DROP FUNCTION IF EXISTS get_audit_logs(UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_audit_logs(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID DEFAULT NULL,
  p_table_name TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_filter_branch_id UUID DEFAULT NULL,
  p_filter_user_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  table_name TEXT,
  record_id UUID,
  action TEXT,
  username TEXT,
  user_role TEXT,
  branch_name TEXT,
  changed_fields TEXT[],
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 권한 검증: 원장(0001) 이상만 접근 가능
  IF p_user_role NOT IN ('0000', '0001') THEN
    RAISE EXCEPTION '감사 로그 조회 권한이 없습니다. (원장 이상 필요)';
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.table_name,
    a.record_id,
    a.action,
    a.username,
    a.user_role,
    a.branch_name,
    a.changed_fields,
    a.old_data,
    a.new_data,
    a.created_at
  FROM audit_logs a
  WHERE 
    -- 지점 격리: 시스템 관리자(0000)가 아니면 본인 지점만
    (p_user_role = '0000' OR a.branch_id = p_user_branch_id OR a.branch_id IS NULL)
    -- 테이블명 필터
    AND (p_table_name IS NULL OR a.table_name = p_table_name)
    -- 액션 필터
    AND (p_action IS NULL OR a.action = p_action)
    -- 지점 필터 (관리자용)
    AND (p_filter_branch_id IS NULL OR a.branch_id = p_filter_branch_id)
    -- 사용자 필터
    AND (p_filter_user_id IS NULL OR a.user_id = p_filter_user_id)
    -- 날짜 범위 필터
    AND (p_start_date IS NULL OR a.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at::DATE <= p_end_date)
  ORDER BY a.created_at DESC
  LIMIT 1000; -- 성능 보호
END;
$$;

COMMENT ON FUNCTION get_audit_logs IS '감사 로그 목록 조회 (원장 이상, 지점 격리, old_data/new_data 포함)';
