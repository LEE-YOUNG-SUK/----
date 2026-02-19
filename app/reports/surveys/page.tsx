import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import SurveyReportClient from './SurveyReportClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '고객 만족도 조사 - DR.Evers ERP',
  description: '지점별 고객 만족도 조사 결과 조회',
}

export default async function SurveyReportPage() {
  const userSession = await requireSession()

  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    redirect('/')
  }

  const supabase = await createServerClient()

  const branchesRes = userSession.role === '0000'
    ? await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
    : { data: [], error: null }

  return (
    <NavigationWrapper user={userSession}>
      <div className="max-w-[1400px] mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">고객 만족도 조사</h1>
        <SurveyReportClient
          userSession={userSession}
          branches={branchesRes.data || []}
        />
      </div>
    </NavigationWrapper>
  )
}
