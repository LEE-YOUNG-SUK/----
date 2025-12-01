/**
 * 판매 관리 페이지
 * 입고 관리(purchases/page.tsx) 구조 100% 적용
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { SaleForm } from '@/components/sales/saleform'
import { getProductsWithStock, getCustomersList, getSalesHistory } from './actions'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHeader } from '@/components/shared/PageHeader'
import { ContentCard } from '@/components/shared/ContentCard'

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
    getProductsWithStock(userSession.branch_id),
    getCustomersList(),
    getSalesHistory(userSession.branch_id, userSession.user_id)
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
    <>
      <NavigationWrapper user={userSession} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-[calc(100vh-140px)] flex flex-col">
            <ContentCard className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">📤 판매 관리</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    품목을 판매하고 FIFO 원가가 자동으로 계산됩니다
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-600">
                    {userSession.role === '0000' ? '전체 지점' : userSession.branch_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
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
                session={userSession}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}