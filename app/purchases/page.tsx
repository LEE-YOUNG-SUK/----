import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'
import { getProductsList, getSuppliersList, getPurchasesHistory } from './actions'

export default async function PurchasesPage() {
  console.log('🔍 [1] 페이지 로딩 시작')
  
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value
  
  if (!token) {
    console.log('❌ [2] 토큰 없음')
    redirect('/login')
  }
  
  console.log('✅ [2] 토큰 확인')
  
  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
  
  const { data: sessionData } = await supabase.rpc('verify_session', { 
    p_token: token 
  })
  
  if (!sessionData?.[0]?.valid) {
    console.log('❌ [3] 세션 무효')
    redirect('/login')
  }
  
  console.log('✅ [3] 세션 유효:', sessionData[0].username)
  
  const session = sessionData[0]
  
  const userSession = {
    user_id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    role: session.role as '0000' | '0001' | '0002' | '0003',
    branch_id: session.branch_id || null,
    branch_name: session.branch_name || null
  }

  console.log('🔍 [4] 데이터 조회 시작')
  
  const [productsResult, suppliersResult, historyResult] = await Promise.all([
    getProductsList(),
    getSuppliersList(),
    getPurchasesHistory(userSession.branch_id)
  ])

  console.log('📊 [5] 조회 결과:')
  console.log('- productsResult.success:', productsResult.success)
  console.log('- productsResult.data 타입:', typeof productsResult.data)
  console.log('- productsResult.data 배열?', Array.isArray(productsResult.data))
  console.log('- productsResult.data 개수:', productsResult.data?.length)
  console.log('- productsResult.data 샘플:', productsResult.data?.[0])
  
  console.log('- suppliersResult.success:', suppliersResult.success)
  console.log('- suppliersResult.data 타입:', typeof suppliersResult.data)
  console.log('- suppliersResult.data 배열?', Array.isArray(suppliersResult.data))
  console.log('- suppliersResult.data 개수:', suppliersResult.data?.length)
  
  console.log('- historyResult.success:', historyResult.success)
  console.log('- historyResult.data 타입:', typeof historyResult.data)
  console.log('- historyResult.data 배열?', Array.isArray(historyResult.data))
  console.log('- historyResult.data 개수:', historyResult.data?.length)

  if (!productsResult.success || !suppliersResult.success) {
    console.log('❌ [6] 데이터 조회 실패')
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationWrapper user={userSession} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">데이터 조회 중 오류가 발생했습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  console.log('✅ [6] 데이터 조회 성공')
  console.log('🔍 [7] 데이터 직렬화 시작')
  
  // 완전한 직렬화 (깊은 복사)
  let products, suppliers, history
  
  try {
    products = JSON.parse(JSON.stringify(productsResult.data || []))
    console.log('✅ products 직렬화 완료:', products.length)
  } catch (e) {
    console.error('❌ products 직렬화 실패:', e)
    products = []
  }
  
  try {
    suppliers = JSON.parse(JSON.stringify(suppliersResult.data || []))
    console.log('✅ suppliers 직렬화 완료:', suppliers.length)
  } catch (e) {
    console.error('❌ suppliers 직렬화 실패:', e)
    suppliers = []
  }
  
  try {
    history = JSON.parse(JSON.stringify(historyResult.data || []))
    console.log('✅ history 직렬화 완료:', history.length)
  } catch (e) {
    console.error('❌ history 직렬화 실패:', e)
    history = []
  }

  console.log('✅ [7] 데이터 직렬화 완료')
  console.log('📦 직렬화 후:')
  console.log('- products 배열?', Array.isArray(products), '개수:', products.length)
  console.log('- suppliers 배열?', Array.isArray(suppliers), '개수:', suppliers.length)
  console.log('- history 배열?', Array.isArray(history), '개수:', history.length)
  
  const formSession = {
    user_id: userSession.user_id,
    branch_id: userSession.branch_id || '',
    branch_name: userSession.branch_name || '',
    role: userSession.role
  }
  
  console.log('🔍 [8] session 객체:', formSession)
  console.log('🎨 [9] 렌더링 시작...')
  
  // 여기서 한 번 더 확인
  console.log('🔍 [10] 최종 Props 확인:')
  console.log('- typeof products:', typeof products)
  console.log('- typeof suppliers:', typeof suppliers)
  console.log('- typeof history:', typeof history)
  console.log('- typeof formSession:', typeof formSession)

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={userSession} />
      
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📥 입고 관리</h1>
              <p className="text-sm text-gray-600 mt-1">
                품목별 입고 데이터를 입력하고 FIFO 재고 레이어를 생성합니다
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {userSession.role === '0000' ? '전체 지점' : userSession.branch_name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                품목: {products.length}개 | 공급업체: {suppliers.length}개
              </div>
            </div>
          </div>
        </div>

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
  )
}