'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import PurchaseHistoryTable from './PurchaseHistoryTable'
import { savePurchases } from '@/app/purchases/actions'
import type { Product, Client } from '@/types'
import type { PurchaseGridRow, PurchaseHistory } from '@/types/purchases'

const PurchaseGrid = dynamic(() => import('./PurchaseGrid'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">그리드 로딩 중...</p>
      </div>
    </div>
  )
})

interface SessionData {
  user_id: string
  branch_id: string
  branch_name: string
  role: string
}

interface Props {
  products: Product[]
  suppliers: Client[]
  history: PurchaseHistory[]
  session: SessionData
}

export function PurchaseForm({ products, suppliers, history, session }: Props) {
  console.log('🎨 PurchaseForm 렌더링')
  console.log('- products:', Array.isArray(products), products.length)
  console.log('- suppliers:', Array.isArray(suppliers), suppliers.length)
  console.log('- history:', Array.isArray(history), history.length)
  console.log('- session:', session)
  
  if (!Array.isArray(products) || !Array.isArray(suppliers) || !Array.isArray(history)) {
    console.error('❌ Props가 배열이 아닙니다!')
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">데이터 형식 오류</div>
      </div>
    )
  }
  
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input')
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (items: PurchaseGridRow[]) => {
    if (!supplierId) {
      alert('공급업체를 선택해주세요.')
      return
    }

    if (!purchaseDate) {
      alert('입고일을 선택해주세요.')
      return
    }

    if (!session.branch_id && session.role !== '0000') {
      alert('지점 정보가 없습니다.')
      return
    }

    const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0)
    const confirmed = confirm(
      `${items.length}개 품목, 총 ₩${totalAmount.toLocaleString()}원을 입고 처리하시겠습니까?`
    )

    if (!confirmed) return

    setIsSaving(true)

    try {
      const result = await savePurchases({
        branch_id: session.branch_id || null,
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        reference_number: referenceNumber,
        notes: notes,
        items: items,
        created_by: session.user_id
      })

      if (result.success) {
        alert(result.message || '입고 처리가 완료되었습니다.')
        setSupplierId('')
        setReferenceNumber('')
        setNotes('')
        setActiveTab('history')
        window.location.reload()
      } else {
        alert(result.message || '입고 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('입고 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  console.log('✅ PurchaseForm 렌더링 준비 완료')

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'input'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            입고 입력
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            입고 내역 ({history.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'input' ? (
          <div className="h-full flex flex-col">
            <div className="bg-white border-b p-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    공급업체 <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">선택하세요</option>
                    {suppliers.map((supplier) => {
                      // 안전한 렌더링
                      const id = String(supplier.id || '')
                      const name = String(supplier.name || '이름 없음')
                      
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    입고일 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    참조번호
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    disabled={isSaving}
                    placeholder="전표번호, 주문번호 등"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비고
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSaving}
                    placeholder="메모 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <PurchaseGrid
                products={products}
                onSave={handleSave}
                isSaving={isSaving}
              />
            </div>
          </div>
        ) : (
          <div className="h-full p-4">
            <PurchaseHistoryTable
              data={history}
              branchName={session.branch_name || '전체 지점'}
            />
          </div>
        )}
      </div>
    </div>
  )
}