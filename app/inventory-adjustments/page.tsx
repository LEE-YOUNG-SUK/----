import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/shared/ContentCard'
import AdjustmentForm from '@/components/inventory-adjustments/AdjustmentForm'
import AdjustmentHistoryTable from '@/components/inventory-adjustments/AdjustmentHistoryTable'
import AdjustmentStats from '@/components/inventory-adjustments/AdjustmentStats'
import { getAdjustmentHistory, getProductsList } from './actions'

export default async function InventoryAdjustmentsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value
  
  if (!token) {
    redirect('/login')
  }
  
  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
  
  const { data: sessionData } = await supabase.rpc('verify_session', { 
    p_token: token 
  })
  
  if (!sessionData?.[0]?.valid) {
    redirect('/login')
  }
  
  const session = sessionData[0]
  
  const userSession = {
    user_id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    role: session.role as '0000' | '0001' | '0002' | '0003',
    branch_id: session.branch_id || null,
    branch_name: session.branch_name || null
  }

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
  
  // branch_id가 null이면 빈 UUID 대신 실제 NULL 전달
  const branchIdForQuery = userSession.branch_id || '00000000-0000-0000-0000-000000000000'
  
  const [productsResult, historyResult] = await Promise.all([
    getProductsList(),
    getAdjustmentHistory(
      userSession.user_id,
      userSession.role,
      branchIdForQuery,
      {
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: today.toISOString().split('T')[0]
      }
    )
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
  } catch (e) {
    console.error('❌ products 직렬화 실패:', e)
    products = []
  }

  try {
    history = JSON.parse(JSON.stringify(historyResult || []))
  } catch (e) {
    console.error('❌ history 직렬화 실패:', e)
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
            <p className="text-sm text-gray-600 mt-1">입고/판매 외 재고 변동 관리</p>
          </div>

          {/* 통계 카드 */}
          <AdjustmentStats
            userId={userSession.user_id}
            userRole={userSession.role}
            userBranchId={branchIdForQuery}
            startDate={thirtyDaysAgo.toISOString().split('T')[0]}
            endDate={today.toISOString().split('T')[0]}
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
              userId={userSession.user_id}
              userBranchId={branchIdForQuery}
            />
          </ContentCard>
        </div>
      </PageLayout>
    </>
  )
}
