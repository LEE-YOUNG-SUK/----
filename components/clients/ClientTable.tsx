'use client'

import { useState } from 'react'
import type { Client } from '@/types'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '../ui/Button'
import { deleteClient } from '@/app/clients/actions'
import ClientFilters from './ClientFilters'

interface ClientTableProps {
  clients: Client[]
  filteredClients: Client[]
  onFilterChange: (filtered: Client[]) => void
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (client: Client) => void
  onAddNew: () => void
}

export default function ClientTable({ 
  clients, 
  filteredClients,
  onFilterChange,
  permissions, 
  onEdit,
  onAddNew 
}: ClientTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const getTypeText = (type: string) => {
    switch (type) {
      case 'supplier': return '공급업체'
      case 'customer': return '고객'
      case 'both': return '공급업체 + 고객'
      default: return type
    }
  }

  const getTypeBadge = (type: string) => {
    const badges = {
      'supplier': 'bg-blue-100 text-blue-800',
      'customer': 'bg-green-100 text-green-800',
      'both': 'bg-purple-100 text-purple-800'
    }
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const formatTaxId = (taxId: string | null) => {
    if (!taxId) return '-'
    if (taxId.length === 10) {
      return `${taxId.slice(0, 3)}-${taxId.slice(3, 5)}-${taxId.slice(5)}`
    }
    return taxId
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`'${client.name}' 거래처를 삭제하시겠습니까?\n\n연결된 입고/판매 내역이 있으면 삭제할 수 없습니다.`)) {
      return
    }

    setDeletingId(client.id)
    try {
      const result = await deleteClient(client.id)
      if (result.success) {
        alert(result.message)
        window.location.reload()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('거래처 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ContentCard>
      {/* 필터 및 버튼 */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <ClientFilters 
            clients={clients}
            onFilterChange={onFilterChange}
          />
          {permissions.canCreate && (
            <Button onClick={onAddNew} size="lg" className="whitespace-nowrap">
              ➕ 새 거래처 추가
            </Button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거래처코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상호명</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">대표자</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연락처</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사업자번호</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등록일</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  검색 결과가 없습니다
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">{client.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{client.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(client.type)}`}>
                      {getTypeText(client.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{client.contact_person || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{client.phone || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{client.email || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{formatTaxId(client.tax_id)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {client.is_active ? '✅ 활성' : '❌ 비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{formatDate(client.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {permissions.canUpdate && (
                        <button
                          onClick={() => onEdit(client)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        >
                          ✏️ 수정
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(client)}
                          disabled={deletingId === client.id}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === client.id ? '⏳ 삭제중' : '🗑️ 삭제'}
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
