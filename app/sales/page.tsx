/**
 * 판매 관리 페이지
 * 입고 관리(purchases/page.tsx) 구조 100% 적용
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { SaleForm } from '@/components/sales/saleform'
import { getProductsWithStock, getCustomersList, getSalesHistory } from './actions'

export default async function SalesPage() {
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
  
  // 데이터 조회 - 빈 배열로 시작 (클라이언트에서 로드)
  const [customersResult] = await Promise.all([
    getCustomersList()
  ])
  
  // 초기 빈 데이터
  const productsResult = { success: true, data: [] }
  const historyResult = { success: true, data: [] }

  console.log('📊 [5] 조회 결과:')
  console.log('- productsResult.success:', productsResult.success)
  console.log('- productsResult.data 타입:', typeof productsResult.data)
  console.log('- productsResult.data 배열?', Array.isArray(productsResult.data))
  console.log('- productsResult.data 개수:', productsResult.data?.length)
  console.log('- productsResult.data 샘플:', productsResult.data?.[0])
  
  console.log('- customersResult.success:', customersResult.success)
  console.log('- customersResult.data 타입:', typeof customersResult.data)
  console.log('- customersResult.data 배열?', Array.isArray(customersResult.data))
  console.log('- customersResult.data 개수:', customersResult.data?.length)
  
  console.log('- historyResult.success:', historyResult.success)
  console.log('- historyResult.data 타입:', typeof historyResult.data)
  console.log('- historyResult.data 배열?', Array.isArray(historyResult.data))
  console.log('- historyResult.data 개수:', historyResult.data?.length)

  // 실패 처리
  if (!productsResult.success || !customersResult.success || !historyResult.success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationWrapper user={userSession} />
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-bold text-lg mb-2">데이터 로딩 실패</h2>
            <ul className="text-red-700 space-y-1">
              {!productsResult.success && <li>• 재고 품목: {productsResult.message}</li>}
              {!customersResult.success && <li>• 고객 목록: {customersResult.message}</li>}
              {!historyResult.success && <li>• 판매 내역: {historyResult.message}</li>}
            </ul>
          </div>
        </main>
      </div>
    )
  }

  // JSON 직렬화 (중요!)
  const serializedProducts = JSON.parse(JSON.stringify(productsResult.data))
  const serializedCustomers = JSON.parse(JSON.stringify(customersResult.data))
  const serializedHistory = JSON.parse(JSON.stringify(historyResult.data))

  console.log('✅ [6] 직렬화 완료, 렌더링 시작')

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={userSession} />
      
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">판매 관리</h1>
          <p className="text-sm text-gray-600 mt-2">
            품목을 판매하고 FIFO 원가가 자동으로 계산됩니다
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg h-[calc(100vh-220px)]">
          <SaleForm
            products={serializedProducts}
            customers={serializedCustomers}
            history={serializedHistory}
            session={userSession}
          />
        </div>
      </main>
    </div>
  )
}