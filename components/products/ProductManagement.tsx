'use client'

import { useState } from 'react'
import type { Product, UserData } from '@/types'
import ProductTable from './ProductTable'
import ProductForm from './ProductForm'
import ProductFilters from './ProductFilters'
import { Button } from '../ui/Button'

interface ProductManagementProps {
  initialProducts: Product[]
  userData: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
}

export default function ProductManagement({
  initialProducts,
  userData,
  permissions
}: ProductManagementProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const handleAddNew = () => {
    setSelectedProduct(null)
    setIsFormOpen(true)
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedProduct(null)
  }

  const handleSuccess = () => {
    // 페이지 새로고침으로 데이터 갱신
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* 필터 및 버튼 */}
      <div className="flex items-center gap-4">
        <ProductFilters 
          products={products}
          onFilterChange={setFilteredProducts}
        />
        {permissions.canCreate && (
          <Button onClick={handleAddNew} size="lg" className="whitespace-nowrap">
            ➕ 새 품목 추가
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <ProductTable
        products={filteredProducts}
        permissions={permissions}
        onEdit={handleEdit}
      />

      {/* 폼 모달 */}
      {isFormOpen && (
        <ProductForm
          product={selectedProduct}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
