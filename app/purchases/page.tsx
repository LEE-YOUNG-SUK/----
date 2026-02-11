import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'
import { getProductsList, getSuppliersList, getPurchasesHistory } from './actions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const userSession = await requireSession()
  const resolvedParams = await searchParams
  const defaultTab = resolvedParams.tab === 'history' ? 'history' : 'input' as 'input' | 'history'

  const [productsResult, suppliersResult, historyResult] = await Promise.all([
    getProductsList(),
    getSuppliersList(),
    getPurchasesHistory(userSession.branch_id, userSession.user_id)
  ])

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
    role: userSession.role
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
                  <div className="text-sm text-gray-600">
                    {userSession.role === '0000' ? '전체 지점' : userSession.branch_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
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