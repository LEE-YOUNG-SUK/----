import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHeader } from '@/components/shared/PageHeader'
import { AuditLogManagement } from '@/components/admin/audit-logs/AuditLogManagement'

/**
 * 감사 로그 페이지 (Phase 3-5)
 * 권한: 원장(0001) 이상
 */
export default async function AuditLogsPage() {
  // 세션 검증
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('erp_session_token')?.value

  if (!sessionToken) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: sessionData } = await supabase.rpc('verify_session', {
    p_token: sessionToken
  })

  const session = sessionData?.[0]

  if (!session?.valid) {
    redirect('/login')
  }

  // 권한 검증: 원장(0001) 이상만 접근 가능
  if (!['0000', '0001'].includes(session.role)) {
    redirect('/')
  }

  const userSession = {
    user_id: session.user_id,
    username: session.username,
    role: session.role,
    branch_id: session.branch_id,
    branch_name: session.branch_name,
  }

  return (
    <PageLayout>
      <PageHeader
        title="감사 로그"
        description="데이터 변경 이력 조회 및 추적"
      />
      <AuditLogManagement userSession={userSession} />
    </PageLayout>
  )
}
