'use client'

/**
 * Phase 3.5: 판매 데이터 수정 모달
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import type { SaleHistory } from '@/types/sales'
import { FormGrid } from '@/components/shared/FormGrid'

interface EditSaleModalProps {
  sale: SaleHistory
  onClose: () => void
  onSave: (data: {
    quantity: number
    unit_price: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }) => Promise<void>
}

export default function EditSaleModal({ sale, onClose, onSave }: EditSaleModalProps) {
  const [quantity, setQuantity] = useState(sale.quantity)
  const [unitPrice, setUnitPrice] = useState(sale.unit_price)
  const [notes, setNotes] = useState('') // SaleHistory에 notes 없음
  const [isSaving, setIsSaving] = useState(false)
  const [taxIncluded, setTaxIncluded] = useState(true)

  // 자동 계산: 공급가, 부가세, 합계
  const [supplyPrice, setSupplyPrice] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)

  useEffect(() => {
    if (taxIncluded) {
      // 부가세 포함: 수량 × 단가 = 합계
      const total = quantity * unitPrice
      const supply = Math.round(total / 1.1)
      const tax = total - supply
      setSupplyPrice(supply)
      setTaxAmount(tax)
      setTotalPrice(total)
    } else {
      // 부가세 미포함: 수량 × 단가 = 공급가
      const supply = quantity * unitPrice
      const tax = Math.round(supply * 0.1)
      const total = supply + tax
      setSupplyPrice(supply)
      setTaxAmount(tax)
      setTotalPrice(total)
    }
  }, [quantity, unitPrice, taxIncluded])

  const handleSave = async () => {
    if (quantity <= 0) {
      alert('수량은 0보다 커야 합니다.')
      return
    }

    if (unitPrice < 0) {
      alert('단가는 0보다 커야 합니다.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        quantity,
        unit_price: unitPrice,
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
          <h2 className="text-xl font-bold text-gray-900">판매 데이터 수정</h2>
          <button
            onClick={onClose}
            className="text-gray-800 hover:text-gray-900 text-2xl leading-none"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="px-6 py-4 space-y-4">
          {/* 판매 정보 (읽기 전용) */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <FormGrid columns={2}>
            <div>
              <p className="text-xs text-gray-900 mb-1">품목코드</p>
              <p className="text-sm font-medium text-gray-900">{sale.product_code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-900 mb-1">품목명</p>
              <p className="text-sm font-medium text-gray-900">{sale.product_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-900 mb-1">고객</p>
              <p className="text-sm font-medium text-gray-900">{sale.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-900 mb-1">판매일</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(sale.sale_date).toLocaleDateString('ko-KR')}
              </p>
            </div>
            {sale.reference_number && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-900 mb-1">참조번호</p>
                <p className="text-sm font-medium text-gray-900">{sale.reference_number}</p>
              </div>
            )}
            </FormGrid>
          </div>

          {/* 수정 가능 필드 */}
          <div className="space-y-4">
            <FormGrid columns={2}>
              {/* 수량 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
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
                  <span className="ml-2 text-sm text-gray-900">{sale.unit}</span>
                </div>
              </div>

              {/* 단가 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  단가 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </FormGrid>

            {/* 부가세 포함/미포함 토글 */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-900">부가세 구분</span>
              <div className="flex bg-gray-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setTaxIncluded(true)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    taxIncluded
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  포함
                </button>
                <button
                  type="button"
                  onClick={() => setTaxIncluded(false)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    !taxIncluded
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-900 hover:text-gray-800'
                  }`}
                >
                  미포함
                </button>
              </div>
              <span className="text-xs text-gray-900">
                {taxIncluded ? '단가 × 수량 = 합계' : '단가 × 수량 = 공급가'}
              </span>
            </div>

            {/* 자동 계산 필드 (읽기 전용) */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <FormGrid columns={3}>
              <div>
                <p className="text-xs text-gray-900 mb-1">공급가</p>
                <p className="text-sm font-semibold text-blue-700">
                  ₩{supplyPrice.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-900 mb-1">부가세 (10%)</p>
                <p className="text-sm font-semibold text-blue-700">
                  ₩{taxAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-900 mb-1">합계</p>
                <p className="text-base font-bold text-blue-900">
                  ₩{totalPrice.toLocaleString()}
                </p>
              </div>
              </FormGrid>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
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
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving} loading={isSaving}>
            저장
          </Button>
        </div>
      </div>
    </div>
  )
}
