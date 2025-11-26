'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Product } from '@/types'
import type { ProductWithStock } from '@/types/sales'
import type { PurchaseGridRow } from '@/types/purchases'
import type { SaleGridRow } from '@/types/sales'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (item: any) => void
  products: (Product | ProductWithStock)[]
  taxIncluded: boolean
  editingItem?: (PurchaseGridRow | SaleGridRow) | null
}

export default function ProductSelectModal({
  isOpen,
  onClose,
  onSave,
  products,
  taxIncluded,
  editingItem
}: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (editingItem) {
      const product = products.find(p => p.id === editingItem.product_id)
      if (product) {
        setSelectedProduct(product as any)
        setSearchTerm(product.name)
      }
      setQuantity(String(editingItem.quantity))
      // 입고는 unit_cost, 판매는 unit_price
      const cost = 'unit_cost' in editingItem ? editingItem.unit_cost : editingItem.unit_price
      setUnitCost(String(cost))
    } else {
      setSearchTerm('')
      setSelectedProduct(null)
      setQuantity('')
      setUnitCost('')
    }
  }, [editingItem, products, isOpen])

  // 품목 검색 필터링
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 10) // 최대 10개만 표시
    
    const search = searchTerm.toLowerCase()
    return products
      .filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search)
      )
      .slice(0, 10)
  }, [searchTerm, products])

  // 가격 계산
  const calculated = useMemo(() => {
    const qty = parseFloat(quantity) || 0
    const cost = parseFloat(unitCost) || 0
    
    if (taxIncluded) {
      // 부가세 포함: 수량 * 단가 = 합계
      const totalPrice = qty * cost
      const supplyPrice = Math.round(totalPrice / 1.1)
      const taxAmount = totalPrice - supplyPrice
      
      return {
        supply_price: supplyPrice,
        tax_amount: taxAmount,
        total_cost: totalPrice
      }
    } else {
      // 부가세 미포함: 수량 * 단가 = 공급가
      const supplyPrice = qty * cost
      const taxAmount = Math.round(supplyPrice * 0.1)
      const totalPrice = supplyPrice + taxAmount
      
      return {
        supply_price: supplyPrice,
        tax_amount: taxAmount,
        total_cost: totalPrice
      }
    }
  }, [quantity, unitCost, taxIncluded])

  // 저장
  const handleSave = () => {
    if (!selectedProduct) {
      alert('품목을 선택해주세요.')
      return
    }
    
    const qty = parseFloat(quantity)
    const cost = parseFloat(unitCost)
    
    if (!qty || qty <= 0) {
      alert('수량을 입력해주세요.')
      return
    }
    
    if (!cost || cost <= 0) {
      alert('단가를 입력해주세요.')
      return
    }

    // 공통 필드
    const baseItem = {
      id: editingItem?.id || `temp-${Date.now()}`,
      product_id: selectedProduct.id,
      product_code: selectedProduct.code,
      product_name: selectedProduct.name,
      category: selectedProduct.category || '',
      unit: selectedProduct.unit,
      specification: selectedProduct.specification || '',
      manufacturer: selectedProduct.manufacturer || '',
      quantity: qty,
      supply_price: calculated.supply_price,
      tax_amount: calculated.tax_amount,
      notes: ''
    }

    // 입고용 또는 판매용 item 생성
    const item = {
      ...baseItem,
      // 입고용 필드
      unit_cost: cost,
      total_cost: calculated.total_cost,
      total_price: calculated.total_cost,
      // 판매용 필드
      unit_price: cost,
      total_amount: calculated.total_cost,
      current_stock: 'current_stock' in selectedProduct ? selectedProduct.current_stock : 0
    }

    onSave(item)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center md:justify-center">
      <div className="bg-white w-full md:max-w-lg md:rounded-lg rounded-t-xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            {editingItem ? '품목 수정' : '품목 추가'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 품목 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              품목 검색 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="품목명 또는 코드 입력"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* 검색 결과 */}
            {searchTerm && filteredProducts.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product as any)
                      setSearchTerm(product.name)
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b last:border-b-0 ${
                      selectedProduct?.id === product.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <p className="text-sm text-gray-500">{product.code}</p>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.unit}</p>
                  </button>
                ))}
              </div>
            )}
            
            {/* 선택된 품목 표시 */}
            {selectedProduct && !searchTerm && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600">{selectedProduct.code}</p>
                <p className="font-medium text-blue-900">{selectedProduct.name}</p>
              </div>
            )}
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수량 <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                {selectedProduct?.unit || '단위'}
              </span>
            </div>
          </div>

          {/* 단가 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              단가 (원) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 부가세 구분 표시 */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-700">
              {taxIncluded ? '부가세 포함' : '부가세 미포함'}
            </span>
          </div>

          {/* 계산 결과 */}
          {quantity && unitCost && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">공급가</span>
                <span className="font-medium">₩{calculated.supply_price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">부가세 (10%)</span>
                <span className="font-medium">₩{calculated.tax_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-blue-700 pt-2 border-t">
                <span>합계</span>
                <span>₩{calculated.total_cost.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 text-base font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            {editingItem ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
