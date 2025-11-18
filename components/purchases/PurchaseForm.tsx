'use client'

/**
 * 입고 입력 폼 (헤더 정보 + 그리드)
 * 동적 import로 AG Grid SSR 문제 해결
 */

import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import PurchaseHistoryTable from './PurchaseHistoryTable'
import { savePurchases } from '@/app/purchases/actions'
import type { Product, Client } from '@/types'
import type { PurchaseGridRow, PurchaseHistory } from '@/types/purchases'

// PurchaseGrid 동적 import (SSR 비활성화)
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

interface Props {
  products: Product[]
  suppliers: Client[]
  history: PurchaseHistory[]
  session: {
    user_id: string
    branch_id: string | null
    branch_name: string | null
    role: string
  }
}

export function PurchaseForm({ products, suppliers, history, session }: Props) {
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input')
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 저장 처리
  const handleSave = async (items: PurchaseGridRow[]) => {
    // 헤더 정보 검증
    if (!supplierId) {
      alert('공급업체를 선택해주세요.')
      return
    }

    if (!purchaseDate) {
      alert('입고일을 선택해주세요.')
      return
    }

    if (!session.branch_id) {
      alert('지점 정보가 없습니다.')
      return
    }

    // 확인
    const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0)
    const confirmed = confirm(
      `${items.length}개 품목, 총 ₩${totalAmount.toLocaleString()}원을 입고 처리하시겠습니까?`
    )

    if (!confirmed) return

    setIsSaving(true)

    try {
      const result = await savePurchases({
        branch_id: session.branch_id,
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        reference_number: referenceNumber,
        notes: notes,
        items: items,
        created_by: session.user_id
      })

      if (result.success) {
        alert(result.message || '입고 처리가 완료되었습니다.')
        
        // 폼 초기화
        setSupplierId('')
        setReferenceNumber('')
        setNotes('')
        
        // 탭 전환
        setActiveTab('history')
        
        // 페이지 새로고침
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

  return (
    <div className="h-full flex flex-col">
      {/* 탭 */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
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

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'input' ? (
          <div className="h-full flex flex-col">
            {/* 헤더 정보 입력 */}
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
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
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

            {/* 그리드 */}
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">그리드 로딩 중...</p>
                  </div>
                </div>
              }>
                <PurchaseGrid
                  products={products}
                  onSave={handleSave}
                  isSaving={isSaving}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="h-full p-4">
            <PurchaseHistoryTable
              data={history}
              branchName={session.branch_name}
            />
          </div>
        )}
      </div>
    </div>
  )
}