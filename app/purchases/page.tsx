/**
 * 입고 관리 페이지
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PurchaseForm } from '@/components/purchases/PurchaseForm'
import { getProductsList, getSuppliersList, getPurchasesHistory } from './actions'

export default async function PurchasesPage() {
  // 세션 확인
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')
  
  if (!sessionCookie) {
    redirect('/login')
  }

  const session = JSON.parse(sessionCookie.value)

  // 데이터 조회
  const [productsResult, suppliersResult, historyResult] = await Promise.all([
    getProductsList(),
    getSuppliersList(),
    getPurchasesHistory(session.branch_id)
  ])

  if (!productsResult.success || !suppliersResult.success) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">데이터 조회 중 오류가 발생했습니다.</p>
          <p className="text-sm text-red-600 mt-2">
            {productsResult.message || suppliersResult.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">입고 관리</h1>
            <p className="text-sm text-gray-600 mt-1">
              품목별 입고 데이터를 입력하고 FIFO 재고 레이어를 생성합니다
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              {session.role === '0000' ? '전체 지점' : session.branch_name}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              품목: {productsResult.data.length}개 | 공급업체: {suppliersResult.data.length}개
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        <PurchaseForm
          products={productsResult.data}
          suppliers={suppliersResult.data}
          history={historyResult.data || []}
          session={session}
        />
      </div>
    </div>
  )
}