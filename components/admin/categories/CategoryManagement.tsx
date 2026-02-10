'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductCategory } from '@/app/admin/categories/actions'
import CategoryTable from './CategoryTable'
import CategoryForm from './CategoryForm'

interface CategoryManagementProps {
  initialCategories: ProductCategory[]
}

export default function CategoryManagement({
  initialCategories
}: CategoryManagementProps) {
  const router = useRouter()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null)

  const handleAddNew = () => {
    setSelectedCategory(null)
    setIsFormOpen(true)
  }

  const handleEdit = (category: ProductCategory) => {
    setSelectedCategory(category)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedCategory(null)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    setSelectedCategory(null)
    router.refresh()
  }

  return (
    <>
      <CategoryTable
        categories={initialCategories}
        onEdit={handleEdit}
        onAddNew={handleAddNew}
      />

      {/* 폼 모달 */}
      {isFormOpen && (
        <CategoryForm
          category={selectedCategory}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}

