'use client'

/**
 * 판매 상세 모달 - 거래번호별 품목 리스트
 * PurchaseDetailModal과 동일한 구조
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import EditSaleModal from './EditSaleModal'
import { deleteSale, updateSale } from '@/app/sales/actions'
import type { SaleHistory } from '@/types/sales'

interface Props {
  referenceNumber: string
  items: SaleHistory[]
  onClose: () => void
  userRole: string
  userId: string
  userBranchId: string
}

export default function SaleDetailModal({
  referenceNumber,
  items: initialItems,
  onClose,
  userRole,
  userId,
  userBranchId
}: Props) {
  const [items, setItems] = useState<SaleHistory[]>(initialItems)
  const [editingSale, setEditingSale] = useState<SaleHistory | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const canEdit = userRole <= '0003' // 모든 역할
  const canDelete = userRole <= '0002' // 원장 이상

  // 판매 수정
  const handleEdit = async (editData: {
    quantity: number
    unit_price: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }) => {
    if (!editingSale) return

    try {
      const result = await updateSale({
        sale_id: editingSale.id,
        user_id: userId,
        user_role: userRole,
        user_branch_id: userBranchId,
        ...editData
      })

      if (result.success) {
        alert(result.message || '판매 정보가 수정되었습니다.')
        setEditingSale(null)
        window.location.reload()
      } else {
        alert(result.message || '수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('판매 수정 오류:', error)
      alert('수정 중 오류가 발생했습니다.')
    }
  }

  // 판매 삭제
  const handleDelete = async (sale: SaleHistory) => {
    if (!confirm(`${sale.product_name} 판매를 삭제하시겠습니까?\n\n삭제하면 재고가 복원됩니다.`)) {
      return
    }

    setIsDeleting(sale.id)
    try {
      const result = await deleteSale({
        sale_id: sale.id,
        user_id: userId,
        user_role: userRole,
        user_branch_id: userBranchId
      })

      if (result.success) {
        alert(result.message || '판매가 삭제되었습니다.')
        window.location.reload()
      } else {
        alert(result.message || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('판매 삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(null)
    }
  }

  const totalAmount = items.reduce((sum, item) => sum + (item.total_amount || 0), 0)
  const totalProfit = items.reduce((sum, item) => sum + (item.profit || 0), 0)

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* 헤더 */}
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">판매 상세</h2>
              <p className="text-sm text-gray-600 mt-1">
                거래번호: <span className="font-medium text-blue-600">{referenceNumber || '(없음)'}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* 통계 */}
          <div className="px-6 py-4 bg-gray-50 border-b grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-600">품목 수</p>
              <p className="text-lg font-bold text-gray-900">{items.length}개</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">총 판매액</p>
              <p className="text-lg font-bold text-blue-600">₩{totalAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">총 이익</p>
              <p className="text-lg font-bold text-green-600">₩{totalProfit.toLocaleString()}</p>
            </div>
          </div>

          {/* 품목 리스트 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">품목코드</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">품목명</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">단위</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">수량</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">단가</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">금액</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">이익</th>
                    {(canEdit || canDelete) && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">액션</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-center font-medium text-blue-600">{item.product_code}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">₩{item.unit_price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-blue-600">₩{item.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">₩{item.profit.toLocaleString()}</td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingSale(item)}
                              >
                                편집
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(item)}
                                disabled={isDeleting === item.id}
                              >
                                {isDeleting === item.id ? '...' : '삭제'}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-6 border-t flex justify-end">
            <Button onClick={onClose} variant="outline">
              닫기
            </Button>
          </div>
        </div>
      </div>

      {/* 편집 모달 */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={handleEdit}
        />
      )}
    </>
  )
}
