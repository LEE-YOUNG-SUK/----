'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { User } from '@/types'
import { SaleRow, Customer, ProductWithStock } from '@/types/sales'
import { saveSales, getProductsWithStock } from '@/app/sales/actions'

const SaleGrid = dynamic(() => import('./sale-grid'), { ssr: false })
const SaleHistoryTable = dynamic(() => import('./sale-history-table'), { ssr: false })

interface SaleFormProps {
  user: User;
  customers: Customer[];
  branches?: { id: string; code: string; name: string }[];
}

export default function SaleForm({ user, customers, branches }: SaleFormProps) {
  const isAdmin = user.role === '0000'
  const [selectedBranch, setSelectedBranch] = useState(user.branch_id || '')
  const [customerId, setCustomerId] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saleData, setSaleData] = useState<SaleRow[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  // 지점 변경 시 재고 있는 품목 로드
  const handleBranchChange = useCallback(async (branchId: string) => {
    setSelectedBranch(branchId)
    if (branchId) {
      const result = await getProductsWithStock(branchId)
      if (result.success) {
        setProducts(result.data)
      }
    }
  }, [])

  // 초기 로드 (일반 사용자는 자동으로 지점 선택)
  useEffect(() => {
    if (!isAdmin && user.branch_id) {
      handleBranchChange(user.branch_id)
    }
  }, [isAdmin, user.branch_id, handleBranchChange])

  const handleSave = async () => {
    // 유효성 검사
    if (!selectedBranch) {
      alert('지점을 선택해주세요')
      return
    }
    if (!customerId) {
      alert('고객을 선택해주세요')
      return
    }
    if (!saleDate) {
      alert('판매일을 입력해주세요')
      return
    }

    const validItems = saleData.filter(item => 
      item.product_code && item.quantity > 0 && item.unit_price > 0
    )

    if (validItems.length === 0) {
      alert('판매 품목을 입력해주세요')
      return
    }

    // 재고 부족 최종 확인
    const insufficientStock = validItems.find(item => item.quantity > item.current_stock)
    if (insufficientStock) {
      alert(`${insufficientStock.product_name} 재고가 부족합니다 (재고: ${insufficientStock.current_stock})`)
      return
    }

    setLoading(true)
    try {
      const result = await saveSales({
        branch_id: selectedBranch,
        customer_id: customerId,
        sale_date: saleDate,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
        items: validItems
      })

      if (result.success) {
        alert(result.message)
        // 폼 초기화
        setCustomerId('')
        setReferenceNumber('')
        setNotes('')
        setSaleData([])
        setTotalAmount(0)
        // 재고 갱신
        await handleBranchChange(selectedBranch)
        // 내역 탭으로 전환
        setActiveTab('history')
      } else {
        alert(`저장 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('저장 오류:', error)
      alert('저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleDataChange = useCallback((data: SaleRow[]) => {
    setSaleData(data)
  }, [])

  const handleTotalChange = useCallback((total: number) => {
    setTotalAmount(total)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* 탭 */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'form'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            판매 등록
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
            판매 내역
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'form' ? (
          <div className="h-full flex flex-col">
            {/* 헤더 정보 - 입고와 동일한 레이아웃 */}
            <div className="bg-white border-b p-4">
              <div className={`grid gap-4 ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
                {/* 지점 선택 (시스템 관리자만) */}
                {isAdmin && branches && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지점 <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">선택하세요</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 고객 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    고객 <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">선택하세요</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 판매일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    판매일 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                {/* 참조번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    참조번호
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    disabled={loading}
                    placeholder="전표번호, 주문번호 등"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                {/* 비고 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비고
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={loading}
                    placeholder="메모 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* 경고 메시지 (재고 없을 때만) */}
            {selectedBranch && products.length === 0 && (
              <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
                <p className="text-yellow-800 text-sm">
                  재고가 있는 품목이 없습니다. 먼저 입고를 진행해주세요.
                </p>
              </div>
            )}

            {/* 지점 미선택 시 안내 */}
            {!selectedBranch && (
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                <p className="text-blue-800 text-sm">
                  지점을 선택하면 품목을 입력할 수 있습니다
                </p>
              </div>
            )}

            {/* 그리드 */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {selectedBranch && (
                <>
                  <div className="flex-1 overflow-hidden">
                    <SaleGrid
                      products={products}
                      onDataChange={handleDataChange}
                      onTotalChange={handleTotalChange}
                    />
                  </div>
                  
                  {/* 합계 및 저장 버튼 */}
                  <div className="bg-white border-t p-4">
                    <div className="flex justify-between items-center">
                      <div className="text-xl font-bold">
                        총 판매금액: <span className="text-blue-600">₩{totalAmount.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={handleSave}
                        disabled={loading || !selectedBranch || saleData.length === 0}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold shadow-lg"
                      >
                        {loading ? '💾 저장 중...' : '💾 일괄 저장'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full p-4">
            <SaleHistoryTable branchId={selectedBranch || user.branch_id || ''} />
          </div>
        )}
      </div>
    </div>
  )
}