'use client'

/**
 * 판매 관리 폼
 * 입고 관리(PurchaseForm) 구조 100% 적용
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import SaleHistoryTable from './salehistorytable'
import MobileSaleInput from './MobileSaleInput'
import { saveSales, getBranchesList, getProductsWithStock } from '@/app/sales/actions'
import { TabNav } from '@/components/shared/TabNav'
import { FormGrid } from '@/components/shared/FormGrid'
import { FormField } from '@/components/shared/FormField'
import { useIsMobile } from '@/hooks/useMediaQuery'
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
  transactionType?: 'SALE' | 'USAGE'  // ✅ 추가
}

export function SaleForm({ products: initialProducts, customers, history, session, transactionType = 'SALE' }: Props) {
  const router = useRouter()

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
  // 부가세 구분 (true: 포함, false: 미포함)
  const [taxIncluded, setTaxIncluded] = useState(true)
  const isMobile = useIsMobile()

  const isSystemAdmin = session.role === '0000'
  
  // ✅ 추가: 내부사용 고객 자동 선택
  const [internalCustomerId, setInternalCustomerId] = useState<string | null>(null)

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
  
  // ✅ 추가: 내부사용(USAGE)일 때 내부사용 고객 자동 선택
  useEffect(() => {
    if (transactionType === 'USAGE') {
      // 내부사용 고객 찾기 (code = 'INTERNAL')
      const internalCustomer = customers.find(c => c.code === 'INTERNAL')
      if (internalCustomer) {
        setInternalCustomerId(internalCustomer.id)
        setCustomerId(internalCustomer.id)
      }
    } else {
      setInternalCustomerId(null)
      // 판매로 전환 시 고객 초기화
      if (customerId === internalCustomerId) {
        setCustomerId('')
      }
    }
  }, [transactionType, customers])

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

  // 저장 시 행은 이미 그리드에서 계산된 supply_price, tax_amount, total_price 사용
  const handleSave = async (items: SaleGridRow[]) => {
    const itemsWithCalc = items.map(item => ({
      ...item,
      // total_amount는 표시용이므로 total_price와 동기화
      total_amount: item.total_price
    }))

    // ✅ 고객 필수 선택 제거 (선택사항으로 변경)

    if (!saleDate) {
      alert('판매일을 선택해주세요.')
      return
    }

    const branchId = isSystemAdmin ? selectedBranchId : session.branch_id

    if (!branchId) {
      alert('지점을 선택해주세요.')
      return
    }

    const totalAmount = itemsWithCalc.reduce((sum, item) => sum + item.total_price, 0)
    const actionText = transactionType === 'USAGE' ? '내부사용' : '판매'
    const confirmed = confirm(
      `${items.length}개 품목, 총 ₩${totalAmount.toLocaleString()}원을 ${actionText} 처리하시겠습니까?`
    )

    if (!confirmed) return

    setIsSaving(true)

    try {
      const result = await saveSales({
        branch_id: branchId,
        customer_id: customerId || null,  // ✅ 빈 값일 경우 null 전달
        sale_date: saleDate,
        reference_number: referenceNumber,
        notes: notes,
        items: itemsWithCalc,
        created_by: session.user_id,
        transaction_type: transactionType  // ✅ 추가
      })

      if (result.success) {
        alert(result.message || '판매 처리가 완료되었습니다.')
        router.refresh()
      } else {
        setIsSaving(false)
        alert(result.message || '판매 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Save error:', error)
      setIsSaving(false)
      alert('판매 처리 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TabNav
        tabs={[
          { id: 'input', label: transactionType === 'USAGE' ? '사용 입력' : '판매 입력' },
          { id: 'history', label: transactionType === 'USAGE' ? '사용 내역' : '판매 내역', count: history.length }
        ]}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as 'input' | 'history')}
      />

      <div className="flex-1 overflow-auto">
        {activeTab === 'input' ? (
          <div className="flex flex-col h-full">
            <div className="bg-white border-b p-3 sm:p-4 flex-shrink-0">
              <FormGrid columns={isSystemAdmin ? 6 : 5}>
                {/* 시스템 관리자만 지점 선택 */}
                {isSystemAdmin && (
                  <FormField label="지점" required>
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
                  </FormField>
                )}

                <FormField label="고객">
                  {transactionType === 'USAGE' ? (
                    /* 내부사용: 고객 고정 표시 */
                    <input
                      type="text"
                      value="내부사용"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  ) : (
                    /* 판매: 고객 선택 */
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">선택하세요</option>
                      {customers.filter(c => c.code !== 'INTERNAL').map((customer) => {
                        const id = String(customer.id || '')
                        const name = String(customer.name || '이름 없음')
                        return (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        )
                      })}
                    </select>
                  )}
                </FormField>

                <FormField label="판매일" required>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </FormField>

                <FormField label="부가세 구분" required>
                  <select
                    value={taxIncluded ? 'included' : 'excluded'}
                    onChange={(e) => setTaxIncluded(e.target.value === 'included')}
                    disabled={isSaving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="included">부가세 포함</option>
                    <option value="excluded">부가세 미포함</option>
                  </select>
                </FormField>

                <FormField label="비고">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSaving}
                    placeholder="메모 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </FormField>
              </FormGrid>
            </div>

            <div className="flex-1 h-full">
              {/* 임시: 항상 그리드 표시 (디버깅용) */}
              <SaleGrid
                products={products}
                onSave={handleSave}
                isSaving={isSaving}
                taxIncluded={taxIncluded}
                transactionType={transactionType}
              />
            </div>
          </div>
        ) : (
          <div className="h-full">
            <SaleHistoryTable
              data={history}
              branchName={session.branch_name || '전체 지점'}
              userRole={session.role}
              userId={session.user_id}
              userBranchId={session.branch_id || ''}
              transactionType={transactionType}
            />
          </div>
        )}
      </div>
    </div>
  )
}