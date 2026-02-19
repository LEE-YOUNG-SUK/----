import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'
import { getProductsList, getSuppliersList, getPurchasesHistory } from './actions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await searchParams
  const defaultTab = resolvedParams.tab === 'history' ? 'history' : 'input' as 'input' | 'history'

  // 세션 검증 + 독립 데이터를 동시 조회
  const [userSession, productsResult, suppliersResult] = await Promise.all([
    requireSession(),
    getProductsList(),
    getSuppliersList()
  ])

  // 초기 조회: 최근 30일
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const initialStartDate = thirtyDaysAgo.toLocaleDateString('sv-SE')
  const initialEndDate = today.toLocaleDateString('sv-SE')

  // 본사 관리자/원장 → 전체 지점, 나머지 → 본인 지점
  const isHqViewer = userSession.is_headquarters && ['0000', '0001'].includes(userSession.role)
  const historyBranchId = isHqViewer ? null : userSession.branch_id
  const historyResult = await getPurchasesHistory(historyBranchId, initialStartDate, initialEndDate)

  if (!productsResult.success || !suppliersResult.success) {
    return (
      <>
        <NavigationWrapper user={userSession} />
        <PageLayout>
          <ContentCard className="bg-red-50 border-red-200">
            <p className="text-red-800">데이터 조회 중 오류가 발생했습니다.</p>
          </ContentCard>
        </PageLayout>
      </>
    )
  }

  let products, suppliers, history

  try {
    products = JSON.parse(JSON.stringify(productsResult.data || []))
  } catch {
    products = []
  }

  try {
    suppliers = JSON.parse(JSON.stringify(suppliersResult.data || []))
  } catch {
    suppliers = []
  }

  try {
    history = JSON.parse(JSON.stringify(historyResult.data || []))
  } catch {
    history = []
  }

  const formSession = {
    user_id: userSession.user_id,
    branch_id: userSession.branch_id || '',
    branch_name: userSession.branch_name || '',
    role: userSession.role,
    is_headquarters: userSession.is_headquarters
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
                  <h1 className="text-2xl font-bold text-gray-900">📥 입고 관리</h1>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-900">
                    {isHqViewer ? '전체 지점' : userSession.branch_name}
                  </div>
                  <div className="text-xs text-gray-900 mt-1">
                    품목: {products.length}개 | 공급업체: {suppliers.length}개
                  </div>
                </div>
              </div>
            </ContentCard>

            <div className="flex-1 overflow-hidden">
              <PurchaseForm
                products={products}
                suppliers={suppliers}
                history={history}
                session={formSession}
                defaultTab={defaultTab}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}