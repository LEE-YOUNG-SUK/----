// ============================================================
// Phase 6: Purchase Report Page
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매 레포트 조회 페이지 (서버 컴포넌트)
// 권한: 원장(0001)/매니저(0002) 이상
// ============================================================

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import PurchaseReportClient from './PurchaseReportClient'

export const metadata = {
  title: '구매 레포트 - DR.Evers ERP',
  description: '입고 현황 레포트 (일별/월별/품목별/공급처별)',
}

export default async function PurchaseReportPage() {
  const userSession = await requireSession()

  // 권한 체크 (원장/매니저 이상만 접근 가능)
  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    redirect('/')
  }

  // 4. 클라이언트 컴포넌트로 전달
  return (
    <NavigationWrapper user={userSession}>
      <div className="max-w-[1400px] mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">📊 구매 레포트</h1>
        <PurchaseReportClient userSession={userSession} />
      </div>
    </NavigationWrapper>
  )
}
