'use client'

import type { Product } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { deleteProduct } from '@/app/products/actions'
import { useState } from 'react'

interface ProductTableProps {
  products: Product[]
  permissions: {
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (product: Product) => void
}

export default function ProductTable({ products, permissions, onEdit }: ProductTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatPrice = (price: number | null) => {
    if (price === null || price === 0) return '-'
    return `${price.toLocaleString('ko-KR')}원`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`'${product.name}' 품목을 삭제하시겠습니까?\n\n연결된 입고/판매 내역이 있으면 삭제할 수 없습니다.`)) {
      return
    }

    setDeletingId(product.id)
    try {
      const result = await deleteProduct(product.id)
      if (result.success) {
        alert(result.message)
        window.location.reload()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('품목 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          검색 결과가 없습니다
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>품목 목록</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목코드</TableHead>
                <TableHead>품명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>단위</TableHead>
                <TableHead className="text-right">표준구매가</TableHead>
                <TableHead className="text-right">표준판매가</TableHead>
                <TableHead>제조사</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.standard_purchase_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.standard_sale_price)}
                  </TableCell>
                  <TableCell>{product.manufacturer || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? '✅ 활성' : '❌ 비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(product.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {permissions.canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(product)}
                        >
                          ✏️ 수정
                        </Button>
                      )}
                      {permissions.canDelete && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? '⏳' : '🗑️'} 삭제
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
