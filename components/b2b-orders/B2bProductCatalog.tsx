'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'

interface OrderableProduct {
  product_id: string
  product_code: string
  product_name: string
  category_name: string | null
  unit: string
  b2b_price: number
  standard_sale_price: number | null
}

interface Props {
  products: OrderableProduct[]
  onAddToCart: (product: OrderableProduct, quantity: number) => void
}

export function B2bProductCatalog({ products, onAddToCart }: Props) {
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
    )
  }, [products, search])

  const handleQuantityChange = (productId: string, value: string) => {
    const num = parseInt(value, 10)
    setQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(num) || num < 1 ? 1 : num,
    }))
  }

  const handleAdd = (product: OrderableProduct) => {
    const qty = quantities[product.product_id] || 1
    onAddToCart(product, qty)
    setQuantities((prev) => ({ ...prev, [product.product_id]: 1 }))
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          inputSize="sm"
          placeholder="품목명, 코드, 카테고리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {search ? '검색 결과가 없습니다.' : '발주 가능한 품목이 없습니다.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>품목명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>단위</TableHead>
              <TableHead className="text-right">B2B 단가</TableHead>
              <TableHead className="w-24 text-center">수량</TableHead>
              <TableHead className="w-20">{' '}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((product) => (
              <TableRow key={product.product_id}>
                <TableCell className="text-sm text-gray-600">{product.product_code}</TableCell>
                <TableCell className="font-medium">{product.product_name}</TableCell>
                <TableCell className="text-sm text-gray-600">{product.category_name || '-'}</TableCell>
                <TableCell>{product.unit}</TableCell>
                <TableCell className="text-right font-medium">
                  {product.b2b_price.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Input
                    inputSize="sm"
                    type="number"
                    min={1}
                    value={quantities[product.product_id] || 1}
                    onChange={(e) => handleQuantityChange(product.product_id, e.target.value)}
                    className="text-center"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAdd(product)}
                  >
                    담기
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
