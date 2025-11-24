'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import PurchaseHistoryTable from './PurchaseHistoryTable'
import { savePurchases, getBranchesList } from '@/app/purchases/actions'
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

interface Branch {
  id: string
  code: string
  name: string
}

interface Props {
  products: Product[]
  suppliers: Client[]
  history: PurchaseHistory[]
  session: SessionData
}

export function PurchaseForm({ products, suppliers, history, session }: Props) {
  if (!Array.isArray(products) || !Array.isArray(suppliers) || !Array.isArray(history)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">데이터 형식 오류</div>
      </div>
    )
  }
  
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState(session.branch_id)
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const isSystemAdmin = session.role === '0000'

  // 시스템 관리자인 경우 지점 목록 조회
  useEffect(() => {
    if (isSystemAdmin) {
      getBranchesList().then((result) => {
        if (result.success) {
          setBranches(result.data)
          // 첫 번째 지점 자동 선택
          if (result.data.length > 0 && !selectedBranchId) {
            setSelectedBranchId(result.data[0].id)
          }
        }
      })
    }
  }, [isSystemAdmin, selectedBranchId])

  const handleSave = async (items: PurchaseGridRow[]) => {
    if (!supplierId) {
      alert('공급업체를 선택해주세요.')
      return
    }

    if (!purchaseDate) {
      alert('입고일을 선택해주세요.')
      return
    }

    const branchId = isSystemAdmin ? selectedBranchId : session.branch_id

    if (!branchId) {
      alert('지점을 선택해주세요.')
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
        branch_id: branchId,
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
              <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 ${isSystemAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
                {/* 시스템 관리자만 지점 선택 */}
                {isSystemAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지점 <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">선택하세요</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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