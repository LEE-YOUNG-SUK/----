'use client'

import { useState } from 'react'
import ProductSelectModal from '@/components/shared/ProductSelectModal'
import type { Product } from '@/types'
import type { PurchaseGridRow } from '@/types/purchases'

interface Props {
  products: Product[]
  onSave: (items: PurchaseGridRow[]) => void
  isSaving: boolean
  taxIncluded: boolean
}

export default function MobilePurchaseInput({ products, onSave, isSaving, taxIncluded }: Props) {
  const [items, setItems] = useState<PurchaseGridRow[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // 품목 삭제
  const handleDelete = (index: number) => {
    if (confirm('이 품목을 삭제하시겠습니까?')) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  // 품목 수정
  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  // 품목 추가/수정 완료
  const handleItemSave = (item: PurchaseGridRow) => {
    if (editingIndex !== null) {
      // 수정
      const newItems = [...items]
      newItems[editingIndex] = item
      setItems(newItems)
      setEditingIndex(null)
    } else {
      // 추가
      setItems([...items, item])
    }
    setIsModalOpen(false)
  }

  // 합계 계산
  const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0)

  // 일괄 저장
  const handleSaveAll = () => {
    if (items.length === 0) {
      alert('품목을 추가해주세요.')
      return
    }
    onSave(items)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 품목 목록 */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            추가된 품목 ({items.length})
          </h3>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">품목을 추가해주세요</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{item.product_code}</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {item.product_name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <p className="text-gray-600">수량</p>
                  <p className="font-medium text-gray-900">
                    {item.quantity.toLocaleString()} {item.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">단가</p>
                  <p className="font-medium text-gray-900">
                    ₩{item.unit_cost.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">공급가</span>
                  <span className="font-medium">₩{item.supply_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">부가세</span>
                  <span className="font-medium">₩{item.tax_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-blue-700">
                  <span>합계</span>
                  <span>₩{item.total_cost.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(index)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 하단 고정 영역 */}
      <div className="border-t bg-white p-4 space-y-3">
        {items.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">총 품목 수</span>
              <span className="font-medium">{items.length}개</span>
            </div>
            <div className="flex justify-between text-base font-bold text-blue-700">
              <span>총 합계</span>
              <span>₩{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setEditingIndex(null)
            setIsModalOpen(true)
          }}
          className="w-full h-12 px-4 text-base font-medium text-blue-700 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          품목 추가
        </button>

        {items.length > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full h-12 px-4 text-base font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                저장 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                일괄 저장
              </>
            )}
          </button>
        )}
      </div>

      {/* 품목 추가/수정 모달 */}
      <ProductSelectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingIndex(null)
        }}
        onSave={handleItemSave}
        products={products}
        taxIncluded={taxIncluded}
        editingItem={editingIndex !== null ? items[editingIndex] : null}
      />
    </div>
  )
}
