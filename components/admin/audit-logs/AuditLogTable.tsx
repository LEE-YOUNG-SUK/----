'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RecordHistoryModal } from './RecordHistoryModal'
import { ROLE_LABELS } from '@/types/permissions'
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

  const getTableNameBadge = (tableName: string) => {
    if (tableName === 'purchases') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          📥 입고
        </span>
      )
    }
    if (tableName === 'sales') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          📤 판매
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
        <p className="text-sm mt-2">데이터 수정/삭제 시 자동으로 기록됩니다.</p>
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
                테이블
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                액션
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                사용자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                역할
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                지점
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                변경 필드
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상세
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(log.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTableNameBadge(log.table_name)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getActionBadge(log.action)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {ROLE_LABELS[log.user_role] || log.user_role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {log.branch_name || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {log.changed_fields && log.changed_fields.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {log.changed_fields.slice(0, 3).map((field, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                        >
                          {field}
                        </span>
                      ))}
                      {log.changed_fields.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{log.changed_fields.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLog(log)}
                  >
                    🔍 상세
                  </Button>
                </td>
              </tr>
            ))}
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
