// ============================================================
// Phase 6: Sales Report Page
// ============================================================
// 작성일: 2025-01-26
// 목적: 판매 레포트 조회 페이지 (서버 컴포넌트)
// 권한: 원장(0001)/매니저(0002) 이상
// ============================================================

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import SalesReportClient from './SalesReportClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '판매 레포트 - DR.Evers ERP',
  description: '판매 현황 레포트 (일별/월별/품목별/고객별)',
}

export default async function SalesReportPage() {
  const userSession = await requireSession()

  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    redirect('/')
  }

  const supabase = await createServerClient()

  const [branchesRes, categoriesRes] = await Promise.all([
    userSession.is_headquarters && ['0000', '0001'].includes(userSession.role)
      ? supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [], error: null }),
    supabase.from('product_categories').select('id, name').eq('is_active', true).order('display_order', { ascending: true })
  ])

  return (
    <NavigationWrapper user={userSession}>
      <div className="max-w-[1400px] mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">💰 판매 레포트</h1>
        <SalesReportClient
          userSession={userSession}
          branches={branchesRes.data || []}
          categories={categoriesRes.data || []}
        />
      </div>
    </NavigationWrapper>
  )
}
