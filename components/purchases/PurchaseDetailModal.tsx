'use client'

/**
 * 거래번호별 입고 상세 모달
 * 거래번호에 포함된 모든 품목 표시 + 개별 편집/삭제
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import EditPurchaseModal from './EditPurchaseModal'
import { updatePurchase, deletePurchase } from '@/app/purchases/actions'
import { usePermissions } from '@/hooks/usePermissions'
import type { PurchaseHistory } from '@/types/purchases'

interface Props {
  referenceNumber: string
  items: PurchaseHistory[]
  onClose: () => void
  userRole: string
  userId: string
  userBranchId: string
}

export default function PurchaseDetailModal({
  referenceNumber,
  items,
  onClose,
  userRole,
  userId,
  userBranchId
}: Props) {
  const [editingPurchase, setEditingPurchase] = useState<PurchaseHistory | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { can } = usePermissions(userRole)

  const canEdit = can('purchases_management', 'update')
  const canDelete = userRole <= '0002' && can('purchases_management', 'delete')

  // 총액 계산
  const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0)

  // 편집 핸들러
  const handleEdit = async (editData: {
    quantity: number
    unit_cost: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }) => {
    if (!editingPurchase) return

    const result = await updatePurchase({
      purchase_id: editingPurchase.id,
      user_id: userId,
      user_role: userRole,
      user_branch_id: userBranchId,
      ...editData
    })

    if (result.success) {
      alert(result.message)
      window.location.reload()
    } else {
      alert(result.message)
    }
  }

  // 삭제 핸들러
  const handleDelete = async (purchase: PurchaseHistory) => {
    if (!confirm(`입고 데이터를 삭제하시겠습니까?\n\n품목: ${purchase.product_name}\n수량: ${purchase.quantity} ${purchase.unit}\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    setIsDeleting(purchase.id)

    const result = await deletePurchase({
      purchase_id: purchase.id,
      user_id: userId,
      user_role: userRole,
      user_branch_id: userBranchId
    })

    setIsDeleting(null)

    if (result.success) {
      alert(result.message)
      window.location.reload()
    } else {
      alert(result.message)
    }
  }

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              거래번호: {referenceNumber || '(없음)'}
            </DialogTitle>
            <div className="text-sm text-gray-600 mt-2">
              입고일: {new Date(items[0]?.purchase_date).toLocaleDateString('ko-KR')} |
              공급업체: {items[0]?.client_name || '(없음)'} |
              품목 수: {items.length}개 |
              총액: <span className="font-semibold text-blue-600">₩{totalAmount.toLocaleString()}</span> |
              담당자: <span className="font-medium">{items[0]?.created_by_name || '알 수 없음'}</span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">
                    품목코드
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">
                    품목명
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                    단위
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    수량
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    단가
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">
                    합계
                  </th>
                  {(canEdit || canDelete) && (
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                      액션
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={`${item.id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-blue-600">
                      {item.product_code}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {item.product_name}
                    </td>
                    <td className="px-3 py-2 text-sm text-center text-gray-600">
                      {item.unit}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900">
                      ₩{item.unit_cost.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-semibold text-blue-600">
                      ₩{item.total_cost.toLocaleString()}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPurchase(item)}
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

          <div className="border-t pt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 편집 모달 */}
      {editingPurchase && (
        <EditPurchaseModal
          purchase={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onSave={handleEdit}
        />
      )}
    </>
  )
}
