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

  const [productsResult, customersResult, historyResult] = await Promise.all([
    getProductsWithStock(userSession.branch_id || ''),
    getCustomersList(),
    getSalesHistory(userSession.branch_id)
  ])

  // 실패 처리
  if (!productsResult.success || !customersResult.success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationWrapper user={userSession} />
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-bold text-lg mb-2">데이터 로딩 실패</h2>
            <ul className="text-red-700 space-y-1">
              {!productsResult.success && <li>• 품목 목록: {productsResult.message}</li>}
              {!customersResult.success && <li>• 고객 목록: {customersResult.message}</li>}
            </ul>
          </div>
        </main>
      </div>
    )
  }

  let products, customers, history
  
  try {
    products = JSON.parse(JSON.stringify(productsResult.data || []))
  } catch (e) {
    console.error('products 직렬화 실패:', e)
    products = []
  }
  
  try {
    customers = JSON.parse(JSON.stringify(customersResult.data || []))
  } catch (e) {
    console.error('customers 직렬화 실패:', e)
    customers = []
  }
  
  try {
    history = JSON.parse(JSON.stringify(historyResult.data || []))
  } catch (e) {
    console.error('history 직렬화 실패:', e)
    history = []
  }

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
            products={products}
            customers={customers}
            history={history}
            session={userSession}
          />
        </div>
      </main>
    </div>
  )
}