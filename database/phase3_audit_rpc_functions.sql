-- =====================================================
-- Phase 3-4: Audit Log 조회용 RPC 함수
-- =====================================================
-- 목적: 감사 로그 조회 및 필터링
-- 권한: 지점 격리 적용 (비-관리자는 본인 지점만)

-- =====================================================
-- 1. 감사 로그 목록 조회
-- =====================================================
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

COMMENT ON FUNCTION get_audit_logs IS '감사 로그 목록 조회 (원장 이상, 지점 격리)';

-- =====================================================
-- 2. 특정 레코드 변경 이력 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_record_history(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID,
  p_record_id UUID,
  p_table_name TEXT
)
RETURNS TABLE (
  id UUID,
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
    a.record_id = p_record_id
    AND a.table_name = p_table_name
    -- 지점 격리: 시스템 관리자가 아니면 본인 지점만
    AND (p_user_role = '0000' OR a.branch_id = p_user_branch_id OR a.branch_id IS NULL)
  ORDER BY a.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_record_history IS '특정 레코드 변경 이력 조회 (원장 이상, 지점 격리)';

-- =====================================================
-- 3. 감사 로그 통계 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_audit_stats(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  table_name TEXT,
  action TEXT,
  count BIGINT,
  unique_users BIGINT,
  first_occurrence TIMESTAMPTZ,
  last_occurrence TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 권한 검증: 원장(0001) 이상만 접근 가능
  IF p_user_role NOT IN ('0000', '0001') THEN
    RAISE EXCEPTION '감사 로그 통계 조회 권한이 없습니다. (원장 이상 필요)';
  END IF;

  RETURN QUERY
  SELECT 
    a.table_name,
    a.action,
    COUNT(*)::BIGINT AS count,
    COUNT(DISTINCT a.user_id)::BIGINT AS unique_users,
    MIN(a.created_at) AS first_occurrence,
    MAX(a.created_at) AS last_occurrence
  FROM audit_logs a
  WHERE 
    -- 지점 격리
    (p_user_role = '0000' OR a.branch_id = p_user_branch_id OR a.branch_id IS NULL)
    -- 날짜 범위
    AND (p_start_date IS NULL OR a.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at::DATE <= p_end_date)
  GROUP BY a.table_name, a.action
  ORDER BY a.table_name, a.action;
END;
$$;

COMMENT ON FUNCTION get_audit_stats IS '감사 로그 통계 조회 (원장 이상, 지점 격리)';

-- =====================================================
-- 4. 사용자별 활동 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_user_role TEXT,
  p_user_branch_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  user_role TEXT,
  branch_name TEXT,
  total_actions BIGINT,
  updates BIGINT,
  deletes BIGINT,
  first_action TIMESTAMPTZ,
  last_action TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 권한 검증: 원장(0001) 이상만 접근 가능
  IF p_user_role NOT IN ('0000', '0001') THEN
    RAISE EXCEPTION '사용자 활동 조회 권한이 없습니다. (원장 이상 필요)';
  END IF;

  RETURN QUERY
  SELECT 
    a.user_id,
    a.username,
    a.user_role,
    a.branch_name,
    COUNT(*)::BIGINT AS total_actions,
    COUNT(CASE WHEN a.action = 'UPDATE' THEN 1 END)::BIGINT AS updates,
    COUNT(CASE WHEN a.action = 'DELETE' THEN 1 END)::BIGINT AS deletes,
    MIN(a.created_at) AS first_action,
    MAX(a.created_at) AS last_action
  FROM audit_logs a
  WHERE 
    -- 지점 격리
    (p_user_role = '0000' OR a.branch_id = p_user_branch_id OR a.branch_id IS NULL)
    -- 특정 사용자 필터
    AND (p_target_user_id IS NULL OR a.user_id = p_target_user_id)
    -- 날짜 범위
    AND (p_start_date IS NULL OR a.created_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at::DATE <= p_end_date)
  GROUP BY a.user_id, a.username, a.user_role, a.branch_name
  ORDER BY total_actions DESC;
END;
$$;

COMMENT ON FUNCTION get_user_activity IS '사용자별 활동 조회 (원장 이상, 지점 격리)';

-- =====================================================
-- 5. 권한 부여
-- =====================================================
GRANT EXECUTE ON FUNCTION get_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_record_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;

-- =====================================================
-- 6. 함수 생성 확인
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ get_audit_logs() - 감사 로그 목록 조회 함수 생성 완료';
  RAISE NOTICE '✅ get_record_history() - 레코드 변경 이력 조회 함수 생성 완료';
  RAISE NOTICE '✅ get_audit_stats() - 감사 로그 통계 함수 생성 완료';
  RAISE NOTICE '✅ get_user_activity() - 사용자 활동 조회 함수 생성 완료';
  RAISE NOTICE '';
  RAISE NOTICE '권한 제한:';
  RAISE NOTICE '  - 모든 함수는 원장(0001) 이상만 접근 가능';
  RAISE NOTICE '  - 시스템 관리자(0000)가 아니면 본인 지점만 조회';
  RAISE NOTICE '  - get_audit_logs는 최대 1000건 반환 (성능 보호)';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계: Phase 3-5 (UI 구현)';
END $$;
