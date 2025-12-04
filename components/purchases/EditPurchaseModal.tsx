'use client'

/**
 * Phase 3.5: 입고 데이터 수정 모달
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import type { PurchaseHistory } from '@/types/purchases'
import { FormGrid } from '@/components/shared/FormGrid'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { SecondaryButton } from '@/components/shared/SecondaryButton'

interface EditPurchaseModalProps {
  purchase: PurchaseHistory
  onClose: () => void
  onSave: (data: {
    quantity: number
    unit_cost: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }) => Promise<void>
}

export default function EditPurchaseModal({ purchase, onClose, onSave }: EditPurchaseModalProps) {
  const [quantity, setQuantity] = useState(purchase.quantity)
  const [unitCost, setUnitCost] = useState(purchase.unit_cost)
  const [notes, setNotes] = useState(purchase.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  // 자동 계산: 공급가, 부가세, 합계
  const [supplyPrice, setSupplyPrice] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)

  useEffect(() => {
    // 공급가 = 수량 × 단가
    const calculated_supply = quantity * unitCost
    
    // 부가세 = 공급가 × 10% (정수)
    const calculated_tax = Math.round(calculated_supply * 0.1)
    
    // 합계 = 공급가 + 부가세
    const calculated_total = calculated_supply + calculated_tax

    setSupplyPrice(calculated_supply)
    setTaxAmount(calculated_tax)
    setTotalPrice(calculated_total)
  }, [quantity, unitCost])

  const handleSave = async () => {
    if (quantity <= 0) {
      alert('수량은 0보다 커야 합니다.')
      return
    }

    if (unitCost <= 0) {
      alert('단가는 0보다 커야 합니다.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        quantity,
        unit_cost: unitCost,
        supply_price: supplyPrice,
        tax_amount: taxAmount,
        total_price: totalPrice,
        notes
      })
      onClose()
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">입고 데이터 수정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="px-6 py-4 space-y-4">
          {/* 입고 정보 (읽기 전용) */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <FormGrid columns={2}>
            <div>
              <p className="text-xs text-gray-600 mb-1">품목코드</p>
              <p className="text-sm font-medium text-gray-900">{purchase.product_code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">품목명</p>
              <p className="text-sm font-medium text-gray-900">{purchase.product_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">공급업체</p>
              <p className="text-sm font-medium text-gray-900">{purchase.client_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">입고일</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(purchase.purchase_date).toLocaleDateString('ko-KR')}
              </p>
            </div>
            {purchase.reference_number && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-600 mb-1">참조번호</p>
                <p className="text-sm font-medium text-gray-900">{purchase.reference_number}</p>
              </div>
            )}
            </FormGrid>
          </div>

          {/* 수정 가능 필드 */}
          <div className="space-y-4">
            <FormGrid columns={2}>
              {/* 수량 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수량 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0.01"
                    step="0.01"
                  />
                  <span className="ml-2 text-sm text-gray-600">{purchase.unit}</span>
                </div>
              </div>

              {/* 단가 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단가 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </FormGrid>

            {/* 자동 계산 필드 (읽기 전용) */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <FormGrid columns={3}>
              <div>
                <p className="text-xs text-gray-600 mb-1">공급가</p>
                <p className="text-sm font-semibold text-blue-700">
                  ₩{supplyPrice.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">부가세 (10%)</p>
                <p className="text-sm font-semibold text-blue-700">
                  ₩{taxAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">합계</p>
                <p className="text-base font-bold text-blue-900">
                  ₩{totalPrice.toLocaleString()}
                </p>
              </div>
              </FormGrid>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비고
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="추가 메모를 입력하세요..."
              />
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
          <SecondaryButton onClick={onClose} disabled={isSaving}>
            취소
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} disabled={isSaving} loading={isSaving}>
            저장
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
