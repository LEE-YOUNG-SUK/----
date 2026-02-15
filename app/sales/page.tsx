/**
 * 판매 관리 페이지 (고객 판매 전용)
 * 입고 관리(purchases/page.tsx) 구조 100% 적용
 */

import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { SaleForm } from '@/components/sales/SaleForm'
import { getProductsWithStock, getCustomersList, getSalesHistory } from './actions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await searchParams
  const defaultTab = resolvedParams.tab === 'history' ? 'history' : 'input' as 'input' | 'history'

  // 세션 검증 + 독립 데이터를 동시 조회
  const [userSession, customersResult] = await Promise.all([
    requireSession(),
    getCustomersList()
  ])

  // 초기 조회: 최근 30일
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const initialStartDate = thirtyDaysAgo.toLocaleDateString('sv-SE')
  const initialEndDate = today.toLocaleDateString('sv-SE')

  // 세션(branch_id) 필요한 쿼리는 이후 병렬 실행
  const [productsResult, historyResult] = await Promise.all([
    getProductsWithStock(userSession.branch_id),
    getSalesHistory(userSession.branch_id, initialStartDate, initialEndDate, 'SALE')
  ])

  // 실패 처리
  if (!productsResult.success || !customersResult.success) {
    return (
      <>
        <NavigationWrapper user={userSession} />
        <PageLayout>
          <ContentCard className="bg-red-50 border-red-200">
            <h2 className="text-red-800 font-bold text-lg mb-2">데이터 로딩 실패</h2>
            <ul className="text-red-700 space-y-1">
              {!productsResult.success && <li>• 품목 목록: {productsResult.message}</li>}
              {!customersResult.success && <li>• 고객 목록: {customersResult.message}</li>}
            </ul>
          </ContentCard>
        </PageLayout>
      </>
    )
  }

  let products, customers, history

  try {
    products = JSON.parse(JSON.stringify(productsResult.data || []))
  } catch {
    products = []
  }

  try {
    customers = JSON.parse(JSON.stringify(customersResult.data || []))
  } catch {
    customers = []
  }

  try {
    history = JSON.parse(JSON.stringify(historyResult.data || []))
  } catch {
    history = []
  }

  return (
    <>
      <NavigationWrapper user={userSession} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="h-[calc(100vh-100px)] flex flex-col">
            <ContentCard className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">💰 판매 관리</h1>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-900">
                    {userSession.role === '0000' ? '전체 지점' : userSession.branch_name}
                  </div>
                  <div className="text-xs text-gray-900 mt-1">
                    품목: {products.length}개 | 고객: {customers.length}개
                  </div>
                </div>
              </div>
            </ContentCard>

            <div className="flex-1 overflow-hidden">
              <SaleForm
                products={products}
                customers={customers}
                history={history}
                session={{
                  user_id: userSession.user_id,
                  branch_id: userSession.branch_id || '',
                  branch_name: userSession.branch_name || '',
                  role: userSession.role
                }}
                transactionType="SALE"
                defaultTab={defaultTab}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}