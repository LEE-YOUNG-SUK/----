// ============================================================
// 재료비 레포트 페이지
// ============================================================
// 작성일: 2025-01-26
// 목적: 사용(내부소모) 재료비 레포트 조회 페이지
// 권한: 원장(0001)/매니저(0002) 이상
// ============================================================

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import UsageReportClient from './UsageReportClient'

export const metadata = {
  title: '재료비 레포트 - DR.Evers ERP',
  description: '내부 사용(소모) 재료비 현황 레포트',
}

export default async function UsageReportPage() {
  // 1. 세션 검증
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const supabase = await createServerClient()

  // 2. 세션 검증 및 사용자 정보 조회
  const { data: sessionData, error: sessionError } = await supabase.rpc('verify_session', {
    p_token: token,
  })

  if (sessionError || !sessionData?.[0]?.valid) {
    redirect('/login')
  }

  const userSession = {
    user_id: sessionData[0].user_id,
    username: sessionData[0].username,
    display_name: sessionData[0].display_name || sessionData[0].username,
    role: sessionData[0].role,
    branch_id: sessionData[0].branch_id,
    branch_name: sessionData[0].branch_name,
  }

  // 3. 권한 체크 (원장/매니저 이상만 접근 가능)
  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    redirect('/')
  }

  // 4. 클라이언트 컴포넌트로 전달
  return (
    <NavigationWrapper user={userSession}>
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📦 재료비 레포트
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            내부 사용(소모)된 재료비 현황을 조회합니다
          </p>
        </div>
        <UsageReportClient userSession={userSession} />
      </div>
    </NavigationWrapper>
  )
}

