'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { getRecordHistory } from '@/app/admin/audit-logs/actions'
import { ROLE_LABELS } from '@/types/permissions'
import type { AuditLogListItem, RecordHistory } from '@/types/audit'

interface Props {
  log: AuditLogListItem
  userSession: {
    user_id: string
    role: string
    branch_id: string | null
  }
  onClose: () => void
}

export function RecordHistoryModal({ log, userSession, onClose }: Props) {
  const [history, setHistory] = useState<RecordHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHistory, setSelectedHistory] = useState<RecordHistory | null>(null)

  useEffect(() => {
    loadHistory()
  }, [log.record_id])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const result = await getRecordHistory(
        userSession.user_id,
        userSession.role,
        userSession.branch_id,
        log.record_id,
        log.table_name
      )

      if (result.success) {
        setHistory(result.data)
        // 첫 번째 이력 자동 선택
        if (result.data.length > 0) {
          setSelectedHistory(result.data[0])
        }
      }
    } catch (error) {
      console.error('Load record history error:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const formatJsonValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const renderDataComparison = (history: RecordHistory) => {
    if (history.action === 'DELETE') {
      // 삭제: old_data만 표시
      return (
        <div>
          <h4 className="font-semibold text-red-600 mb-2">🗑️ 삭제된 데이터</h4>
          <div className="bg-red-50 p-4 rounded-md border border-red-200">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(history.old_data, null, 2)}
            </pre>
          </div>
        </div>
      )
    }

    if (history.action === 'UPDATE') {
      // 수정: old_data와 new_data 비교
      const changedFields = history.changed_fields || []
      
      return (
        <div className="space-y-4">
          <h4 className="font-semibold text-blue-600 mb-2">
            ✏️ 변경된 필드 ({changedFields.length}개)
          </h4>
          
          {changedFields.length > 0 ? (
            <div className="space-y-3">
              {changedFields.map((field) => {
                const oldValue = history.old_data?.[field]
                const newValue = history.new_data?.[field]
                
                return (
                  <div key={field} className="border rounded-md p-3 bg-gray-50">
                    <div className="font-medium text-sm text-gray-700 mb-2">
                      📌 {field}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500 mb-1">이전 값</div>
                        <div className="bg-red-50 p-2 rounded border border-red-200 text-red-700">
                          {formatJsonValue(oldValue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">변경 값</div>
                        <div className="bg-green-50 p-2 rounded border border-green-200 text-green-700">
                          {formatJsonValue(newValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">변경된 필드 정보 없음</p>
          )}

          {/* 전체 데이터 보기 */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              전체 데이터 보기
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">이전 데이터</div>
                <pre className="text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(history.old_data, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">변경 데이터</div>
                <pre className="text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(history.new_data, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📜 레코드 변경 이력
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 레코드 정보 */}
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">테이블:</span>{' '}
                <span className="font-medium">{log.table_name}</span>
              </div>
              <div>
                <span className="text-gray-600">레코드 ID:</span>{' '}
                <span className="font-mono text-xs">{log.record_id}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              변경 이력이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* 이력 목록 */}
              <div className="col-span-1 space-y-2">
                <h3 className="font-semibold text-sm text-gray-700 mb-2">
                  변경 이력 ({history.length}건)
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHistory(h)}
                      className={`w-full text-left p-3 rounded-md border transition ${
                        selectedHistory?.id === h.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        {formatDate(h.created_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            h.action === 'UPDATE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {h.action === 'UPDATE' ? '✏️ 수정' : '🗑️ 삭제'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {h.username} ({ROLE_LABELS[h.user_role]})
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="col-span-2">
                {selectedHistory ? (
                  <div className="space-y-4">
                    {/* 헤더 */}
                    <div className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">
                          {selectedHistory.action === 'UPDATE' ? '✏️ 수정 내역' : '🗑️ 삭제 내역'}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {formatDate(selectedHistory.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {selectedHistory.username} ({ROLE_LABELS[selectedHistory.user_role]})
                        {selectedHistory.branch_name && ` · ${selectedHistory.branch_name}`}
                      </div>
                    </div>

                    {/* 데이터 비교 */}
                    {renderDataComparison(selectedHistory)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    이력을 선택하세요
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 닫기 버튼 */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
