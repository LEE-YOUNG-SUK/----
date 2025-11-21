-- sessions 테이블 생성
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON public.sessions(is_valid);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (시스템 관리자만 접근 가능)
CREATE POLICY "시스템 관리자는 모든 세션 조회 가능" ON public.sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = '0000'
        )
    );

-- 서비스 역할로 모든 작업 허용 (서버에서 세션 관리)
CREATE POLICY "서비스 역할은 모든 세션 작업 가능" ON public.sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE public.sessions IS '사용자 세션 정보';
COMMENT ON COLUMN public.sessions.id IS '세션 ID';
COMMENT ON COLUMN public.sessions.user_id IS '사용자 ID';
COMMENT ON COLUMN public.sessions.token IS '세션 토큰';
COMMENT ON COLUMN public.sessions.is_valid IS '세션 유효 여부';
COMMENT ON COLUMN public.sessions.created_at IS '생성 시각';
COMMENT ON COLUMN public.sessions.expires_at IS '만료 시각';
COMMENT ON COLUMN public.sessions.last_activity IS '마지막 활동 시각';
