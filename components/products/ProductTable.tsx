'use client'

import { useState } from 'react'
import type { Product } from '@/types'
import { ContentCard } from '@/components/shared/ContentCard'
import { Button } from '../ui/Button'
import { deleteProduct } from '@/app/products/actions'
import ProductFilters from './ProductFilters'

interface ProductTableProps {
  products: Product[]
  filteredProducts: Product[]
  onFilterChange: (filtered: Product[]) => void
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (product: Product) => void
  onAddNew: () => void
}

export default function ProductTable({ 
  products, 
  filteredProducts,
  onFilterChange,
  permissions, 
  onEdit,
  onAddNew 
}: ProductTableProps) {
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

  return (
    <ContentCard>
      {/* 필터 및 버튼 */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <ProductFilters 
            products={products}
            onFilterChange={onFilterChange}
          />
          {permissions.canCreate && (
            <Button onClick={onAddNew} size="lg" className="whitespace-nowrap">
              ➕ 새 품목 추가
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품명</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단위</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">표준구매가</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">표준판매가</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제조사</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등록일</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  검색 결과가 없습니다
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">{product.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{product.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {product.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {product.category}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{product.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-700">{formatPrice(product.standard_purchase_price)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-700">{formatPrice(product.standard_sale_price)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{product.manufacturer || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {product.is_active ? '✅ 활성' : '❌ 비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{formatDate(product.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {permissions.canUpdate && (
                        <button
                          onClick={() => onEdit(product)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                        >
                          ✏️ 수정
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.id}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === product.id ? '⏳ 삭제NULL' : '🗑️ 삭제'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ContentCard>
  )
}
