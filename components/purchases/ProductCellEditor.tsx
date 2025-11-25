'use client'

/**
 * AG Grid용 품목 자동완성 셀 에디터 (입고용)
 * Portal 패턴 사용하여 드롭다운을 셀 밖에 렌더링
 */

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@/types'

interface ProductCellEditorProps {
  value: string
  products: Product[]
  onProductSelect: (product: Product) => void
  stopEditing: () => void
}

export const ProductCellEditor = forwardRef((props: ProductCellEditorProps, ref) => {
  const { value, products, onProductSelect, stopEditing } = props
  
  const [inputValue, setInputValue] = useState(value || '')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const isSelectingRef = useRef(false) // 클릭 중인지 추적
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{left: number, top: number, width: number} | null>(null)

  // AG Grid에서 값을 가져갈 때 사용 - 선택된 product.code 우선 반환
  useImperativeHandle(ref, () => ({
    getValue: () => {
      return selectedProduct ? selectedProduct.code : inputValue
    },
    isCancelAfterEnd: () => false
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
  const handleSelect = (product: Product) => {
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

  // 선택된 항목 스크롤
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
              <div className="flex items-start justify-between gap-4">
                {/* 왼쪽: 품목 정보 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-blue-600">
                      {product.code}
                    </span>
                    {product.category && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {product.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {product.specification && (
                      <span>규격: {product.specification}</span>
                    )}
                    {product.manufacturer && (
                      <span>• 제조사: {product.manufacturer}</span>
                    )}
                  </div>
                </div>
                
                {/* 오른쪽: 가격 정보 */}
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">
                    {product.unit}
                  </div>
                  <div className="text-sm font-bold text-green-600">
                    ₩{product.standard_purchase_price?.toLocaleString() || 0}
                  </div>
                  {(product as any).last_purchase_price && 
                   (product as any).last_purchase_price !== product.standard_purchase_price && (
                    <div className="text-xs text-gray-400 line-through">
                      ₩{(product as any).last_purchase_price.toLocaleString()}
                    </div>
                  )}
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