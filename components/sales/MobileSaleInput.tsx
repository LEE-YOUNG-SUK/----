'use client'

import { useState } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import ProductSelectModal from '@/components/shared/ProductSelectModal'
import type { ProductWithStock } from '@/types/sales'
import type { SaleGridRow } from '@/types/sales'

interface Props {
  products: ProductWithStock[]
  onSave: (items: SaleGridRow[]) => void
  isSaving: boolean
  taxIncluded: boolean
}

export default function MobileSaleInput({ products, onSave, isSaving, taxIncluded }: Props) {
  const [items, setItems] = useState<SaleGridRow[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const { confirm, ConfirmDialogComponent } = useConfirm()

  // 품목 삭제
  const handleDelete = async (index: number) => {
    const ok = await confirm({ title: '삭제 확인', message: '이 품목을 삭제하시겠습니까?', variant: 'danger' })
    if (ok) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  // 품목 수정
  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  // 품목 추가/수정 완료
  const handleItemSave = (item: SaleGridRow) => {
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
  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0)

  // 일괄 저장
  const handleSaveAll = () => {
    if (items.length === 0) {
      alert('판매할 품목을 추가해주세요.')
      return
    }

    // ✅ 재고 부족 체크 제거 - 마이너스 재고 허용
    // const insufficientStock = items.find(item => {
    //   const product = products.find(p => p.id === item.product_id)
    //   return product && item.quantity > product.current_stock
    // })

    // if (insufficientStock) {
    //   const product = products.find(p => p.id === insufficientStock.product_id)
    //   alert(`재고 부족: ${insufficientStock.product_name} (현재고: ${product?.current_stock || 0}, 판매수량: ${insufficientStock.quantity})`)
    //   return
    // }

    onSave(items)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 품목 리스트 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-800 space-y-3">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-base font-medium">판매 품목을 추가해주세요</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              {/* 품목 헤더 */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-900">#{item.product_code}</span>
                    {item.current_stock !== undefined && (
                      <span className={`text-xs font-medium ${item.current_stock < item.quantity ? 'text-red-600' : 'text-green-600'}`}>
                        재고: {item.current_stock.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{item.product_name}</h3>
                  {item.specification && (
                    <p className="text-sm text-gray-900 mt-1">{item.specification}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => handleEdit(index)}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* 금액 정보 */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-900">수량:</span>
                  <span className="font-medium">{item.quantity.toLocaleString()} {item.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">단가:</span>
                  <span className="font-medium">{item.unit_price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">공급가:</span>
                  <span className="font-medium">{item.supply_price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900">부가세:</span>
                  <span className="font-medium">{item.tax_amount.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between col-span-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-semibold">합계:</span>
                  <span className="text-blue-600 font-bold text-base">{item.total_price.toLocaleString()}원</span>
                </div>
              </div>

              {/* 비고 */}
              {item.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">비고:</span> {item.notes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 하단 고정 영역 */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3 space-y-3">
        {/* 합계 표시 */}
        <div className="flex justify-between items-center px-3">
          <span className="text-base font-semibold text-gray-900">전체 합계</span>
          <span className="text-xl font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
        </div>

        {/* 버튼 영역 */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingIndex(null)
              setIsModalOpen(true)
            }}
            disabled={isSaving}
            className="flex-1 h-14 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-semibold hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + 품목 추가
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || items.length === 0}
            className="flex-1 h-14 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '저장 중...' : '일괄 저장'}
          </button>
        </div>
      </div>

      {/* 품목 선택 모달 */}
      <ProductSelectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingIndex(null)
        }}
        onSave={handleItemSave}
        products={products}
        taxIncluded={taxIncluded}
        editingItem={editingIndex !== null ? items[editingIndex] : undefined}
      />
      {ConfirmDialogComponent}
    </div>
  )
}
