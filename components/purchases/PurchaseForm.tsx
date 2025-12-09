'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import PurchaseHistoryTable from './PurchaseHistoryTable'
import MobilePurchaseInput from './MobilePurchaseInput'
import { savePurchases, getBranchesList } from '@/app/purchases/actions'
import { TabNav } from '@/components/shared/TabNav'
import { FormGrid } from '@/components/shared/FormGrid'
import { FormField } from '@/components/shared/FormField'
import { useIsMobile } from '@/hooks/useMediaQuery'
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
  // 부가세 구분 (true: 포함, false: 미포함)
  const [taxIncluded, setTaxIncluded] = useState(true)
  const isMobile = useIsMobile()

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
    // PurchaseGrid에서 이미 계산 완료된 데이터 사용
    // ✅ 공급업체 필수 선택 제거 (선택사항으로 변경)

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
        supplier_id: supplierId || null,  // ✅ 빈 값일 경우 null 전달
        purchase_date: purchaseDate,
        reference_number: referenceNumber,
        notes: notes,
        items: items,
        created_by: session.user_id
      })

      if (result.success) {
        // ✅ 성공 시 즉시 리로드 (AG Grid 에러 방지)
        alert(result.message || '입고 처리가 완료되었습니다.')
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setIsSaving(false)
        alert(result.message || '입고 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Save error:', error)
      setIsSaving(false)
      alert('입고 처리 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TabNav
        tabs={[
          { id: 'input', label: '입고 입력' },
          { id: 'history', label: '입고 내역', count: history.length }
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
                  </FormField>
                )}

                <FormField label="공급업체">
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
                </FormField>

                <FormField label="입고일" required>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
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

                <FormField label="참조번호">
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    disabled={isSaving}
                    placeholder="전표번호, 주문번호 등"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
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
              <PurchaseGrid
                products={products}
                onSave={handleSave}
                isSaving={isSaving}
                taxIncluded={taxIncluded}
              />
            </div>
          </div>
        ) : (
          <div className="h-full">
            <PurchaseHistoryTable
              data={history}
              branchName={session.branch_name || '전체 지점'}
              userRole={session.role}
              userId={session.user_id}
              userBranchId={session.branch_id}
            />
          </div>
        )}
      </div>
    </div>
  )
}