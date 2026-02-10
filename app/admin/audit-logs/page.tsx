import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHeader } from '@/components/shared/PageHeader'
import { AuditLogManagement } from '@/components/admin/audit-logs/AuditLogManagement'

/**
 * 감사 로그 페이지 (Phase 3-5)
 * 권한: 원장(0001) 이상
 */
export default async function AuditLogsPage() {
  const userSession = await requireSession()

  // 권한 검증: 원장(0001) 이상만 접근 가능
  if (!['0000', '0001'].includes(userSession.role)) {
    redirect('/')
  }

  return (
    <>
      <NavigationWrapper user={userSession} />
      <PageLayout>
        <PageHeader
          title="감사 로그"
          description="데이터 변경 이력 조회 및 추적"
        />
        <AuditLogManagement userSession={userSession} />
      </PageLayout>
    </>
  )
}
