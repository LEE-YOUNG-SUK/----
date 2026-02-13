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
import { getFieldLabel } from '@/lib/audit-field-labels'
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
    // 주요 필드 정의 (표시 순서)
    const displayFields = ['product_name', 'quantity', 'unit_price', 'supply_price', 'tax_amount', 'total_price', 'total_cost']
    
    // 포맷팅 함수
    const formatValue = (field: string, value: any): string => {
      if (value === null || value === undefined) return '-'
      
      // 숫자 필드
      if (['quantity', 'unit_price', 'supply_price', 'tax_amount', 'total_price', 'total_cost'].includes(field)) {
        const num = Number(value)
        if (field.includes('price') || field.includes('cost') || field.includes('amount')) {
          return `₩${num.toLocaleString()}`
        }
        return num.toLocaleString()
      }
      
      // 불린 필드
      if (typeof value === 'boolean') {
        return value ? 'O' : 'X'
      }
      
      return String(value)
    }
    
    if (history.action === 'DELETE') {
      // 삭제: 한 줄로 이전 값만 표시
      const oldData = history.old_data || {}
      const fieldsToShow = displayFields.filter(f => oldData[f] !== undefined && oldData[f] !== null)
      
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-red-600 mb-3">🗑️ 삭제된 데이터</h4>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  {fieldsToShow.map(field => (
                    <th key={field} className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-900">
                      {getFieldLabel(field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-red-50">
                  {fieldsToShow.map(field => (
                    <td key={field} className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                      {formatValue(field, oldData[field])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (history.action === 'UPDATE') {
      // 수정: 첫 줄 이전값, 둘째 줄 수정값
      const oldData = history.old_data || {}
      const newData = history.new_data || {}
      const changedFields = history.changed_fields || []
      
      // 모든 데이터 필드 수집 (변경된 것과 변경되지 않은 것 포함)
      const allFields = displayFields.filter(f => 
        oldData[f] !== undefined || newData[f] !== undefined
      )
      
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-blue-600 mb-3">
            ✏️ 수정 내역 ({changedFields.length}개 필드 변경)
          </h4>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-900 w-20">
                    구분
                  </th>
                  {allFields.map(field => (
                    <th 
                      key={field} 
                      className={`border border-gray-300 px-3 py-2 text-left text-xs font-medium ${
                        changedFields.includes(field) ? 'bg-yellow-100 text-yellow-900' : 'text-gray-900'
                      }`}
                    >
                      {getFieldLabel(field)}
                      {changedFields.includes(field) && ' ⚠️'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 이전 값 */}
                <tr className="bg-red-50">
                  <td className="border border-gray-300 px-3 py-2 text-xs font-medium text-red-700">
                    이전
                  </td>
                  {allFields.map(field => (
                    <td 
                      key={field} 
                      className={`border border-gray-300 px-3 py-2 text-sm ${
                        changedFields.includes(field) ? 'bg-red-100 text-red-900 font-medium' : 'text-gray-900'
                      }`}
                    >
                      {formatValue(field, oldData[field])}
                    </td>
                  ))}
                </tr>
                
                {/* 수정 값 */}
                <tr className="bg-green-50">
                  <td className="border border-gray-300 px-3 py-2 text-xs font-medium text-green-700">
                    수정
                  </td>
                  {allFields.map(field => (
                    <td 
                      key={field} 
                      className={`border border-gray-300 px-3 py-2 text-sm ${
                        changedFields.includes(field) ? 'bg-green-100 text-green-900 font-medium' : 'text-gray-900'
                      }`}
                    >
                      {formatValue(field, newData[field])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
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
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-900">테이블:</span>{' '}
                <span className="font-medium">{log.table_name}</span>
              </div>
              <div>
                <span className="text-gray-900">레코드 ID:</span>{' '}
                <span className="font-mono text-xs">{log.record_id}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-900">
              변경 이력이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* 이력 목록 */}
              <div className="col-span-1 space-y-2">
                <h3 className="font-semibold text-sm text-gray-900 mb-2">
                  변경 이력 ({history.length}건)
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHistory(h)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        selectedHistory?.id === h.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="text-xs text-gray-900 mb-1">
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
                      <div className="text-xs text-gray-900 mt-1">
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
                        <span className="text-sm text-gray-900">
                          {formatDate(selectedHistory.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 mt-1">
                        {selectedHistory.username} ({ROLE_LABELS[selectedHistory.user_role]})
                        {selectedHistory.branch_name && ` · ${selectedHistory.branch_name}`}
                      </div>
                    </div>

                    {/* 데이터 비교 */}
                    {renderDataComparison(selectedHistory)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-900">
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
