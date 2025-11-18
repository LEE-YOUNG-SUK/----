// components/sales/product-cell-editor.tsx
'use client'

/**
 * AG Grid용 품목 자동완성 셀 에디터 (판매용 - 재고 표시)
 */

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import type { ProductWithStock } from '@/types/sales'

interface ProductCellEditorProps {
  value: string
  products: ProductWithStock[]
  onProductSelect: (rowIndex: number, product: ProductWithStock) => void
  node: any
  stopEditing: () => void
}

export const ProductCellEditor = forwardRef<any, ProductCellEditorProps>(
  (props, ref) => {
    const [inputValue, setInputValue] = useState(props.value || '')
    const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      getValue: () => inputValue,
      isCancelAfterEnd: () => false,
      isCancelBeforeStart: () => false
    }))

    useEffect(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, [])

    // 실시간 검색 필터링
    useEffect(() => {
      if (inputValue.length >= 1) {
        const search = inputValue.toLowerCase()
        const filtered = props.products.filter(
          (p) =>
            p.code.toLowerCase().includes(search) ||
            p.name.toLowerCase().includes(search)
        )
        setFilteredProducts(filtered.slice(0, 10))
        setShowDropdown(filtered.length > 0)
        setSelectedIndex(0)
      } else {
        setFilteredProducts([])
        setShowDropdown(false)
      }
    }, [inputValue, props.products])

    const handleSelect = (product: ProductWithStock) => {
      setInputValue(product.code)
      setShowDropdown(false)
      
      // 부모에게 선택된 품목 전달
      if (props.node && props.node.rowIndex !== null && props.node.rowIndex !== undefined) {
        props.onProductSelect(props.node.rowIndex, product)
      }
      
      // 편집 종료
      setTimeout(() => {
        props.stopEditing()
      }, 100)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          props.stopEditing()
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
        case 'Tab':
          e.preventDefault()
          if (filteredProducts[selectedIndex]) {
            handleSelect(filteredProducts[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowDropdown(false)
          props.stopEditing()
          break
      }
    }

    // 선택된 항목으로 스크롤
    useEffect(() => {
      if (showDropdown && dropdownRef.current) {
        const selectedElement = dropdownRef.current.children[
          selectedIndex
        ] as HTMLElement
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest' })
        }
      }
    }, [selectedIndex, showDropdown])

    return (
      <div className="relative w-full h-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="w-full h-full px-2 border-none outline-none bg-transparent"
          placeholder="품목코드 또는 품목명 입력"
        />

        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full w-[500px] max-h-80 overflow-y-auto bg-white border border-gray-300 shadow-lg z-[9999]"
            style={{ marginTop: '2px' }}
          >
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                onClick={() => handleSelect(product)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
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
                      product.current_stock < 10 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      재고: {product.current_stock}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ₩{product.standard_sale_price.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

ProductCellEditor.displayName = 'ProductCellEditor'

export default ProductCellEditor