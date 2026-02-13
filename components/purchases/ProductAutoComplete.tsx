'use client'

/**
 * AG Grid용 품목 자동완성 셀 에디터
 */

import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import type { Product } from '@/types'

interface ProductAutoCompleteProps {
  value: string
  products: Product[]
  onValueChange: (product: Product | null) => void
}

export interface ProductAutoCompleteRef {
  getValue: () => string
}

export const ProductAutoComplete = forwardRef<ProductAutoCompleteRef, ProductAutoCompleteProps>(
  ({ value, products, onValueChange }, ref) => {
    const [inputValue, setInputValue] = useState(value || '')
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      getValue: () => inputValue
    }))

    useEffect(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, [])

    useEffect(() => {
      if (inputValue.length >= 1) {
        const search = inputValue.toLowerCase()
        const filtered = products.filter(
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
    }, [inputValue, products])

    const handleSelect = (product: Product) => {
      setInputValue(product.code)
      setShowDropdown(false)
      onValueChange(product)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!showDropdown) return

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
          setShowDropdown(false)
          break
      }
    }

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
            className="absolute left-0 top-full w-96 max-h-80 overflow-y-auto bg-white border border-gray-300 shadow-lg z-50"
          >
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                onClick={() => handleSelect(product)}
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
                  index === selectedIndex ? 'bg-blue-100' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">
                      {product.code}
                    </div>
                    <div className="text-xs text-gray-900">{product.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-900">{product.unit}</div>
                    <div className="text-xs font-medium text-blue-600">
                      ₩{product.standard_purchase_price?.toLocaleString() || 0}
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

ProductAutoComplete.displayName = 'ProductAutoComplete'