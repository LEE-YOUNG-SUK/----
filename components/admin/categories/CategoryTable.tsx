'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/hooks/useConfirm'
import type { ProductCategory } from '@/app/admin/categories/actions'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { deleteCategory } from '@/app/admin/categories/actions'

interface CategoryTableProps {
  categories: ProductCategory[]
  onEdit: (category: ProductCategory) => void
  onAddNew: () => void
}

export default function CategoryTable({
  categories,
  onEdit,
  onAddNew
}: CategoryTableProps) {
  const router = useRouter()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (category: ProductCategory) => {
    if (category.product_count > 0) {
      alert(`이 카테고리를 사용하는 품목이 ${category.product_count}개 있어 삭제할 수 없습니다.`)
      return
    }

    const ok = await confirm({ title: '삭제 확인', message: `'${category.name}' 카테고리를 삭제하시겠습니까?`, variant: 'danger' })
    if (!ok) return

    setDeletingId(category.id)
    try {
      const result = await deleteCategory(category.id)
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('카테고리 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <ContentCard>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">카테고리 목록</h2>
          <p className="text-sm text-gray-500 mt-1">총 {categories.length}개</p>
        </div>
        <Button onClick={onAddNew} size="lg">
          ➕ 새 카테고리 추가
        </Button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리명</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">설명</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">표시순서</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">품목수</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  등록된 카테고리가 없습니다
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">{category.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{category.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{category.description || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-700">{category.display_order}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {category.product_count}개
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      category.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {category.is_active ? '✅ 활성' : '❌ 비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(category)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                      >
                        ✏️ 수정
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        disabled={deletingId === category.id || category.product_count > 0}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={category.product_count > 0 ? '사용 중인 카테고리는 삭제할 수 없습니다' : ''}
                      >
                        {deletingId === category.id ? '⏳ 삭제 중...' : '🗑️ 삭제'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ContentCard>
    {ConfirmDialogComponent}
  </>
  )
}

