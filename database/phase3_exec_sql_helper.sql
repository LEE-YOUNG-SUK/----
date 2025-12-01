-- =====================================================
-- Phase 3-3: exec_sql 헬퍼 함수 생성
-- =====================================================
-- 목적: Server Actions에서 set_config() 실행을 위한 헬퍼 함수
-- 사용: audit log 트리거에서 사용자 컨텍스트 설정

CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

COMMENT ON FUNCTION exec_sql(TEXT) IS 'Server Actions에서 동적 SQL 실행 (set_config 등)';

-- 권한 부여
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;

-- 배포 확인 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ exec_sql() 헬퍼 함수 생성 완료';
  RAISE NOTICE '';
  RAISE NOTICE '사용 예시:';
  RAISE NOTICE '  SELECT exec_sql(''SELECT set_config(''''app.current_user_id'''', ''''user-uuid'''', false)'');';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  보안: SECURITY DEFINER로 실행되므로 신중하게 사용';
END $$;
