'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RecordHistoryModal } from './RecordHistoryModal'
import { ROLE_LABELS } from '@/types/permissions'
import { getFieldLabel } from '@/lib/audit-field-labels'
import type { AuditLogListItem } from '@/types/audit'

interface Props {
  logs: AuditLogListItem[]
  loading: boolean
  userSession: {
    user_id: string
    role: string
    branch_id: string | null
  }
}

export function AuditLogTable({ logs, loading, userSession }: Props) {
  const [selectedLog, setSelectedLog] = useState<AuditLogListItem | null>(null)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionBadge = (action: string) => {
    if (action === 'INSERT') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ➕ 등록
        </span>
      )
    }
    if (action === 'UPDATE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ✏️ 수정
        </span>
      )
    }
    if (action === 'DELETE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          🗑️ 삭제
        </span>
      )
    }
    return <span>{action}</span>
  }

  const TABLE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    purchases: { label: '입고', emoji: '📥', color: 'bg-green-100 text-green-800' },
    sales: { label: '판매', emoji: '📤', color: 'bg-purple-100 text-purple-800' },
    inventory_adjustments: { label: '재고조정', emoji: '📦', color: 'bg-yellow-100 text-yellow-800' },
    products: { label: '품목', emoji: '🏷️', color: 'bg-indigo-100 text-indigo-800' },
    clients: { label: '거래처', emoji: '🏢', color: 'bg-teal-100 text-teal-800' },
    branches: { label: '지점', emoji: '🏬', color: 'bg-orange-100 text-orange-800' },
  }

  const getTableNameBadge = (tableName: string) => {
    const info = TABLE_LABELS[tableName]
    if (info) {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
          {info.emoji} {info.label}
        </span>
      )
    }
    return <span>{tableName}</span>
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">📭 감사 로그가 없습니다.</p>
        <p className="text-sm mt-2">데이터 등록/수정/삭제 시 자동으로 기록됩니다.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                일시
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                변경내용
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                사용자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                지점
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상세
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => {
              // 변경내용을 품목명 포함하여 구체적으로 표현
              const getChangeDescription = () => {
                const tableInfo = TABLE_LABELS[log.table_name]
                const tableLabel = tableInfo?.label || log.table_name

                // 품목명 추출
                const data = log.old_data || log.new_data
                const productName = data?.product_name || null

                if (log.action === 'INSERT') {
                  return (
                    <div className="text-green-600">
                      <div className="font-medium">
                        ➕ {productName ? `[${productName}]` : ''} {tableLabel} 데이터 <strong>등록</strong>
                      </div>
                    </div>
                  )
                }

                if (log.action === 'DELETE') {
                  return (
                    <div className="text-red-600">
                      <div className="font-medium">
                        🗑️ {productName ? `[${productName}]` : ''} {tableLabel} 데이터 <strong>삭제</strong>
                      </div>
                    </div>
                  )
                }

                if (log.action === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0) {
                  const fieldCount = log.changed_fields.length
                  const fieldLabels = log.changed_fields.slice(0, 2).map(getFieldLabel).join(', ')
                  const moreCount = fieldCount > 2 ? fieldCount - 2 : 0

                  return (
                    <div className="text-blue-600">
                      <div className="font-medium">
                        ✏️ {productName ? `[${productName}]` : ''} {tableLabel} 데이터 <strong>수정</strong>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {fieldLabels}{moreCount > 0 && ` 외 ${moreCount}개`}
                      </div>
                    </div>
                  )
                }

                return (
                  <span className="text-gray-600">
                    ✏️ {tableLabel} 데이터를 수정했습니다
                  </span>
                )
              }
              
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getChangeDescription()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <div className="text-gray-900 font-medium">{log.username}</div>
                      <div className="text-gray-500 text-xs">{ROLE_LABELS[log.user_role] || log.user_role}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {log.branch_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLog(log)}
                    >
                      🔍 상세보기
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 상세 모달 */}
      {selectedLog && (
        <RecordHistoryModal
          log={selectedLog}
          userSession={userSession}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </>
  )
}
