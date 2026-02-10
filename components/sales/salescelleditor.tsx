'use client'

/**
 * AG Grid용 품목 자동완성 셀 에디터 (판매용)
 * 입고용 ProductCellEditor와 100% 동일한 구조 + 재고 표시
 */

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ProductWithStock } from '@/types/sales'

interface ProductCellEditorProps {
  value: string
  products: ProductWithStock[]
  onProductSelect: (product: ProductWithStock) => void
  stopEditing: () => void
}

export const ProductCellEditor = forwardRef((props: ProductCellEditorProps, ref) => {
  const { value, products, onProductSelect, stopEditing } = props
  
  const [inputValue, setInputValue] = useState(value || '')
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null)
  const isSelectingRef = useRef(false) // 클릭 중인지 추적
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{left: number, top: number, width: number} | null>(null)

  // AG Grid에서 값을 가져갈 때 사용
  useImperativeHandle(ref, () => ({
    getValue: () => {
      return selectedProduct ? selectedProduct.code : inputValue;
    },
    isCancelAfterEnd: () => false,
  }))

  // 마운트 시 포커스 및 드롭다운 위치 계산
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPos({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY + 2,
        width: rect.width
      })
    }
  }, [])

  // 검색어 변경 시 필터링 및 드롭다운 위치 재계산
  useEffect(() => {
    if (inputValue.length >= 1) {
      const search = inputValue.toLowerCase()
      const filtered = products.filter((p) =>
        p.code.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search)
      )
      setFilteredProducts(filtered.slice(0, 10))
      setShowDropdown(filtered.length > 0)
      setSelectedIndex(0)
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect()
        setDropdownPos({
          left: rect.left + window.scrollX,
          top: rect.bottom + window.scrollY + 2,
          width: rect.width
        })
      }
    } else {
      setFilteredProducts([])
      setShowDropdown(false)
    }
  }, [inputValue, products])

  // 품목 선택
  const handleSelect = (product: ProductWithStock) => {
    isSelectingRef.current = true
    setInputValue(product.code)
    setSelectedProduct(product)
    setShowDropdown(false)
    
    // 그리드에 값 반영
    onProductSelect(product)
    
    // 편집 종료
    setTimeout(() => {
      stopEditing()
      isSelectingRef.current = false
    }, 100)
  }

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Escape') {
        stopEditing()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredProducts[selectedIndex]) {
          handleSelect(filteredProducts[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        stopEditing()
        break
      case 'Tab':
        if (filteredProducts[selectedIndex]) {
          e.preventDefault()
          handleSelect(filteredProducts[selectedIndex])
        }
        break
    }
  }

  // 선택된 항목으로 스크롤
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, showDropdown])

  return (
    <div className="relative w-full h-full">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          setSelectedProduct(null)
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // 클릭 중이 아닐 때만 드롭다운 숨기기
          setTimeout(() => {
            if (!isSelectingRef.current) {
              setShowDropdown(false)
            }
          }, 150)
        }}
        className="w-full h-full px-2 border-none outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="품목코드 또는 품목명 입력"
      />

      {showDropdown && dropdownPos && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="w-[500px] max-h-80 overflow-y-auto bg-white border border-gray-300 shadow-xl z-[9999]"
          style={{
            position: 'absolute',
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: 500,
            marginTop: 0
          }}
        >
          {filteredProducts.map((product, index) => (
            <div
              key={product.id}
              onMouseDown={(e) => {
                // onBlur보다 먼저 실행되도록 onMouseDown 사용
                e.preventDefault() // input blur 방지
                handleSelect(product)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">
                    [{product.code}] {product.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {product.specification && `${product.specification} | `}
                    {product.manufacturer && `${product.manufacturer} | `}
                    {product.unit}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${
                    product.current_stock <= 0 
                      ? 'text-red-600' 
                      : product.current_stock < 10
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    재고: {product.current_stock.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ₩{product.standard_sale_price.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
})

ProductCellEditor.displayName = 'ProductCellEditor'

export default ProductCellEditor