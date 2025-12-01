-- =====================================================
-- Phase 3: Audit Log 시스템 구축
-- =====================================================
-- 목적: 모든 데이터 변경 이력 추적 (수정/삭제)
-- 보안: 누가, 언제, 무엇을, 어떻게 변경했는지 완전 추적

-- =====================================================
-- 1. audit_logs 테이블 생성
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 감사 대상
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  
  -- 작업 정보
  action TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE', 'INSERT')),
  
  -- 변경 전/후 데이터 (JSONB로 저장)
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  
  -- 사용자 정보
  user_id UUID NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  user_role TEXT NOT NULL,
  
  -- 지점 정보
  branch_id UUID REFERENCES branches(id),
  branch_name TEXT,
  
  -- 추가 정보
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. 인덱스 생성 (조회 성능 최적화)
-- =====================================================
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name, created_at DESC);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_branch_id ON audit_logs(branch_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created_date ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_branch_date ON audit_logs(branch_id, created_at DESC);

-- =====================================================
-- 3. 코멘트 추가
-- =====================================================
COMMENT ON TABLE audit_logs IS '데이터 변경 감사 로그 - 모든 수정/삭제 이력 추적';
COMMENT ON COLUMN audit_logs.table_name IS '변경된 테이블명';
COMMENT ON COLUMN audit_logs.record_id IS '변경된 레코드 ID';
COMMENT ON COLUMN audit_logs.action IS '작업 유형: UPDATE, DELETE, INSERT';
COMMENT ON COLUMN audit_logs.old_data IS '변경 전 데이터 (JSONB)';
COMMENT ON COLUMN audit_logs.new_data IS '변경 후 데이터 (JSONB)';
COMMENT ON COLUMN audit_logs.changed_fields IS '변경된 필드 목록 (UPDATE만)';

-- =====================================================
-- 4. 헬퍼 함수: JSONB 변경 필드 추출
-- =====================================================
CREATE OR REPLACE FUNCTION get_changed_fields(old_data JSONB, new_data JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  changed_fields TEXT[] := ARRAY[]::TEXT[];
  key TEXT;
BEGIN
  FOR key IN SELECT jsonb_object_keys(old_data)
  LOOP
    IF old_data->key IS DISTINCT FROM new_data->key THEN
      changed_fields := array_append(changed_fields, key);
    END IF;
  END LOOP;
  
  RETURN changed_fields;
END;
$$;

COMMENT ON FUNCTION get_changed_fields(JSONB, JSONB) IS 'JSONB 비교하여 변경된 필드 목록 반환';

-- =====================================================
-- 5. 권한 부여
-- =====================================================
GRANT SELECT ON audit_logs TO authenticated;

-- =====================================================
-- 6. 테이블 생성 확인
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    RAISE NOTICE '✅ audit_logs 테이블 생성 완료';
    RAISE NOTICE '✅ 7개 인덱스 생성 완료';
    RAISE NOTICE '✅ get_changed_fields() 헬퍼 함수 생성 완료';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계: Phase 3-2 (트리거 생성)';
  END IF;
END $$;