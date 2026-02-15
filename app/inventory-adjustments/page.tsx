import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'
import AdjustmentForm from '@/components/inventory-adjustments/AdjustmentForm'
import AdjustmentHistoryTable from '@/components/inventory-adjustments/AdjustmentHistoryTable'
import AdjustmentStats from '@/components/inventory-adjustments/AdjustmentStats'
import { getAdjustmentHistory, getProductsList } from './actions'

export const dynamic = 'force-dynamic'

export default async function InventoryAdjustmentsPage() {
  // 세션 검증 + 품목 목록 동시 조회
  const productsPromise = getProductsList()
  const userSession = await requireSession()

  // 권한 체크: 매니저 이상 (0000~0002)
  if (!['0000', '0001', '0002'].includes(userSession.role)) {
    return (
      <>
        <NavigationWrapper user={userSession} />
        <PageLayout>
          <ContentCard className="bg-red-50 border-red-200">
            <p className="text-red-800">재고 조정 기능은 매니저 이상만 사용할 수 있습니다.</p>
          </ContentCard>
        </PageLayout>
      </>
    )
  }

  // 데이터 병렬 조회
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  // branch_id 검증: null이면 재고 조정 불가
  if (!userSession.branch_id) {
    return (
      <>
        <NavigationWrapper user={userSession} />
        <PageLayout>
          <ContentCard className="bg-yellow-50 border-yellow-200">
            <p className="text-yellow-800">재고 조정을 하려면 지점이 할당되어야 합니다. 관리자에게 문의하세요.</p>
          </ContentCard>
        </PageLayout>
      </>
    )
  }
  
  const branchIdForQuery = userSession.branch_id
  
  const [productsResult, historyResult] = await Promise.all([
    productsPromise,
    getAdjustmentHistory({
      start_date: thirtyDaysAgo.toLocaleDateString('sv-SE'),
      end_date: today.toLocaleDateString('sv-SE')
    })
  ])

  if (!productsResult.success) {
    return (
      <>
        <NavigationWrapper user={userSession} />
        <PageLayout>
          <ContentCard className="bg-red-50 border-red-200">
            <p className="text-red-800">품목 데이터 조회 중 오류가 발생했습니다.</p>
          </ContentCard>
        </PageLayout>
      </>
    )
  }

  // 직렬화 (클라이언트 컴포넌트로 전달)
  let products, history
  try {
    products = JSON.parse(JSON.stringify(productsResult.data || []))
  } catch {
    products = []
  }

  try {
    history = JSON.parse(JSON.stringify(historyResult || []))
  } catch {
    history = []
  }

  return (
    <>
      <NavigationWrapper user={userSession} />
      <PageLayout>
        <div className="space-y-6">
          {/* 페이지 헤더 */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📝 재고 조정</h1>
            <p className="text-sm text-gray-900 mt-1">입고/판매 외 재고 변동 관리</p>
          </div>

          {/* 통계 카드 */}
          <AdjustmentStats
            startDate={thirtyDaysAgo.toLocaleDateString('sv-SE')}
            endDate={today.toLocaleDateString('sv-SE')}
          />

          {/* 조정 입력 폼 */}
          <ContentCard>
            <h2 className="text-xl font-semibold mb-6">✏️ 새 조정 입력</h2>
            <AdjustmentForm 
              products={products} 
              session={{
                user_id: userSession.user_id,
                branch_id: branchIdForQuery,
                branch_name: userSession.branch_name || '',
                role: userSession.role
              }}
            />
          </ContentCard>

          {/* 조정 내역 테이블 */}
          <ContentCard className="h-[600px] p-0 overflow-hidden">
            <AdjustmentHistoryTable
              data={history}
              branchName={userSession.branch_name}
              userRole={userSession.role}
            />
          </ContentCard>
        </div>
      </PageLayout>
    </>
  )
}
