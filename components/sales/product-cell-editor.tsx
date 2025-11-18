// components/sales/product-cell-editor.tsx
'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { ICellEditorParams } from 'ag-grid-community'
import { ProductWithStock } from '@/types/sales'

interface ProductCellEditorProps extends ICellEditorParams {
  products: ProductWithStock[]
  onProductSelect: (rowIndex: number, product: ProductWithStock) => void
}

const ProductCellEditor = forwardRef((props: ProductCellEditorProps, ref) => {
  console.log('📝 ProductCellEditor 렌더링')
  console.log('📦 받은 products:', props.products)
  console.log('📊 products 개수:', props.products?.length)
  
  const [value, setValue] = useState(props.value || '')
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    isCancelAfterEnd: () => false,
    isCancelBeforeStart: () => false,
    focusIn: () => inputRef.current?.focus(),
    focusOut: () => inputRef.current?.blur()
  }))

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    if (value.trim()) {
      const filtered = props.products.filter(p =>
        p.code.toLowerCase().includes(value.toLowerCase()) ||
        p.name.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredProducts(filtered)
      setShowDropdown(filtered.length > 0)
      setSelectedIndex(0)
    } else {
      setFilteredProducts([])
      setShowDropdown(false)
    }
  }, [value, props.products])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        props.stopEditing()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (filteredProducts[selectedIndex]) {
          selectProduct(filteredProducts[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        props.stopEditing(true) // cancel
        break
    }
  }

  const selectProduct = (product: ProductWithStock) => {
    setValue(product.code)
    setShowDropdown(false)
    
    // 부모에게 선택된 제품 정보 전달
    if (props.node && props.node.rowIndex !== null) {
      props.onProductSelect(props.node.rowIndex, product)
    }
    
    // 편집 종료
    setTimeout(() => props.stopEditing(), 100)
  }

  return (
    <div className="relative w-full h-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => {
            setShowDropdown(false)
            props.stopEditing()
          }, 200)
        }}
        className="w-full h-full px-2 border-none outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="코드 또는 품목명 입력..."
      />
      
      {showDropdown && filteredProducts.length > 0 && (
        <div className="absolute top-full left-0 w-96 max-h-60 overflow-y-auto bg-white border border-gray-300 shadow-lg z-50">
          {filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className={`px-3 py-2 cursor-pointer border-b ${
                index === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                selectProduct(product)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    [{product.code}] {product.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {product.specification && `${product.specification} | `}
                    {product.manufacturer && `${product.manufacturer} | `}
                    {product.unit}
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <div className={`text-sm font-bold ${
                    product.current_stock < 10 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    재고: {product.current_stock.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
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
})

ProductCellEditor.displayName = 'ProductCellEditor'

export default ProductCellEditor