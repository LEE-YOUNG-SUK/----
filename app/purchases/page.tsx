import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'
import { getProductsList, getSuppliersList, getPurchasesHistory } from './actions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/shared/ContentCard'

export default async function PurchasesPage() {
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
  } catch (e) {
    console.error('❌ products 직렬화 실패:', e)
    products = []
  }
  
  try {
    suppliers = JSON.parse(JSON.stringify(suppliersResult.data || []))
  } catch (e) {
    console.error('❌ suppliers 직렬화 실패:', e)
    suppliers = []
  }
  
  try {
    history = JSON.parse(JSON.stringify(historyResult.data || []))
  } catch (e) {
    console.error('❌ history 직렬화 실패:', e)
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
                  <p className="text-sm text-gray-600 mt-1">
                    품목별 입고 데이터를 입력하고 FIFO 재고 레이어를 생성합니다
                  </p>
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
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}