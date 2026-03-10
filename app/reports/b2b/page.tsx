import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bReportClient } from './B2bReportClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'B2B 정산 리포트 - DR.Evers ERP',
  description: 'B2B 발주 미수/정산 리포트',
}

export default async function B2bReportPage() {
  const userSession = await requireSession()

  // 본사(0000) 또는 원장(0001)만 접근 가능
  if (!['0000', '0001'].includes(userSession.role)) {
    redirect('/')
  }

  return (
    <NavigationWrapper user={userSession}>
      <B2bReportClient session={userSession} />
    </NavigationWrapper>
  )
}
