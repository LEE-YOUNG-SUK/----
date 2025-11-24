'use client'

import { useState } from 'react'
import type { Branch } from '@/types'
import { ContentCard } from '@/components/shared/ContentCard'
import { Button } from '@/components/ui/Button'
import { deleteBranch } from '@/app/admin/branches/actions'

interface BranchTableProps {
  branches: Branch[]
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (branch: Branch) => void
  onAddNew: () => void
}

export default function BranchTable({ 
  branches, 
  permissions,
  onEdit,
  onAddNew 
}: BranchTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const formatBusinessNumber = (businessNumber: string | null) => {
    if (!businessNumber) return '-'
    if (businessNumber.length === 10) {
      return `${businessNumber.slice(0, 3)}-${businessNumber.slice(3, 5)}-${businessNumber.slice(5)}`
    }
    return businessNumber
  }

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`'${branch.name}' 지점을 삭제하시겠습니까?\n\n연결된 사용자나 데이터가 있으면 삭제할 수 없습니다.`)) {
      return
    }

    setDeletingId(branch.id)
    try {
      const result = await deleteBranch(branch.id)
      if (result.success) {
        alert('지점이 삭제되었습니다')
        window.location.reload()
      } else {
        alert(result.message || '지점 삭제에 실패했습니다')
      }
    } catch (error) {
      alert('지점 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ContentCard>
      {/* 헤더 및 버튼 */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">
              총 {branches.length}개의 지점이 등록되어 있습니다
            </p>
          </div>
          {permissions.canCreate && (
            <Button onClick={onAddNew} size="lg" className="whitespace-nowrap">
              ➕ 새 지점 추가
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                코드
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                지점명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                대표자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                이메일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                사업자번호
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                등록일
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {branches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  등록된 지점이 없습니다
                </td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {branch.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {branch.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {branch.contact_person || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {branch.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatBusinessNumber(branch.business_number)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(branch.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      {permissions.canUpdate && (
                        <button
                          onClick={() => onEdit(branch)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          수정
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(branch)}
                          disabled={deletingId === branch.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {deletingId === branch.id ? '삭제 중...' : '삭제'}
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
