'use client'

/**
 * 판매 관리 폼
 * 입고 관리(PurchaseForm) 구조 100% 적용
 */

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import SaleHistoryTable from './salehistorytable'
import { saveSales, getBranchesList, getProductsWithStock } from '@/app/sales/actions'
import type { ProductWithStock, SaleGridRow, SaleHistory } from '@/types/sales'

const SaleGrid = dynamic(() => import('./salegrid'), {
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

interface Customer {
  id: string
  code: string
  name: string
}

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
  products: ProductWithStock[]
  customers: Customer[]
  history: SaleHistory[]
  session: SessionData
}

export function SaleForm({ products: initialProducts, customers, history, session }: Props) {
  if (!Array.isArray(initialProducts) || !Array.isArray(customers) || !Array.isArray(history)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">데이터 형식 오류</div>
      </div>
    )
  }
  
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState(session.branch_id)
  const [products, setProducts] = useState<ProductWithStock[]>(initialProducts)
  const [customerId, setCustomerId] = useState('')
  const [saleDate, setSaleDate] = useState(
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
            const firstBranchId = result.data[0].id
            setSelectedBranchId(firstBranchId)
            // 첫 번째 지점의 재고 있는 품목 로드
            loadProductsForBranch(firstBranchId)
          }
        }
      })
    } else {
      // 일반 사용자는 자기 지점 품목 자동 로드
      if (session.branch_id) {
        loadProductsForBranch(session.branch_id)
      }
    }
  }, [isSystemAdmin])

  // 지점 변경 시 재고 있는 품목 다시 로드
  const loadProductsForBranch = async (branchId: string) => {
    if (!branchId) return
    
    const result = await getProductsWithStock(branchId)
    if (result.success) {
      setProducts(result.data)
    }
  }

  // 시스템 관리자가 지점 변경할 때
  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId)
    loadProductsForBranch(branchId)
  }

  const handleSave = async (items: SaleGridRow[]) => {
    if (!customerId) {
      alert('고객을 선택해주세요.')
      return
    }

    if (!saleDate) {
      alert('판매일을 선택해주세요.')
      return
    }

    const branchId = isSystemAdmin ? selectedBranchId : session.branch_id

    if (!branchId) {
      alert('지점을 선택해주세요.')
      return
    }

    const totalAmount = items.reduce((sum, item) => sum + item.total_amount, 0)
    const confirmed = confirm(
      `${items.length}개 품목, 총 ₩${totalAmount.toLocaleString()}원을 판매 처리하시겠습니까?`
    )

    if (!confirmed) return

    setIsSaving(true)

    try {
      const result = await saveSales({
        branch_id: branchId,
        customer_id: customerId,
        sale_date: saleDate,
        reference_number: referenceNumber,
        notes: notes,
        items: items,
        created_by: session.user_id
      })

      if (result.success) {
        alert(result.message || '판매 처리가 완료되었습니다.')
        setCustomerId('')
        setReferenceNumber('')
        setNotes('')
        setActiveTab('history')
        window.location.reload()
      } else {
        alert(result.message || '판매 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('판매 처리 중 오류가 발생했습니다.')
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
            판매 입력
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
            판매 내역 ({history.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'input' ? (
          <div className="h-full flex flex-col">
            <div className="bg-white border-b p-4">
              <div className={`grid gap-4 ${isSystemAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
                {/* 시스템 관리자만 지점 선택 */}
                {isSystemAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지점 <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={selectedBranchId || ''}
                      onChange={(e) => handleBranchChange(e.target.value)}
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
                    고객 <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">선택하세요</option>
                    {customers.map((customer) => {
                      const id = String(customer.id || '')
                      const name = String(customer.name || '이름 없음')
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
                    판매일 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
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
              <SaleGrid
                products={products}
                onSave={handleSave}
                isSaving={isSaving}
              />
            </div>
          </div>
        ) : (
          <div className="h-full p-4">
            <SaleHistoryTable
              data={history}
              branchName={session.branch_name || '전체 지점'}
            />
          </div>
        )}
      </div>
    </div>
  )
}