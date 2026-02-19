'use client'

/**
 * 재고 조정 내역 테이블 (Phase 5: Inventory Adjustment)
 * - 필터링: 날짜, 유형, 사유
 * - 페이지네이션
 * - 취소 버튼 (원장 이상, 당일만)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelAdjustment } from '@/app/inventory-adjustments/actions'
import { useConfirm } from '@/hooks/useConfirm'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { 
  InventoryAdjustment, 
  AdjustmentType, 
  AdjustmentReason,
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_TYPE_LABELS
} from '@/types/inventory-adjustment'

interface AdjustmentHistoryTableProps {
  data: InventoryAdjustment[]
  branchName: string | null
  userRole: string
}

export default function AdjustmentHistoryTable({
  data,
  branchName,
  userRole
}: AdjustmentHistoryTableProps) {
  const router = useRouter()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<AdjustmentType | ''>('')
  const [reasonFilter, setReasonFilter] = useState<AdjustmentReason | ''>('')
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const itemsPerPage = 20

  // 취소 권한: 원장 이상 (0000, 0001)
  const canCancel = ['0000', '0001'].includes(userRole)

  // 오늘 날짜
  const today = new Date().toLocaleDateString('sv-SE')

  const reasonLabels: Record<AdjustmentReason, string> = {
    STOCK_COUNT: '실사',
    DAMAGE: '불량',
    LOSS: '분실',
    RETURN: '반품',
    OTHER: '기타'
  }

  const typeLabels: Record<AdjustmentType, string> = {
    INCREASE: '증가',
    DECREASE: '감소'
  }

  // 필터링
  const filteredData = data.filter((item) => {
    // 검색
    const matchesSearch = 
      (item.product_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    // 유형 필터
    const matchesType = !typeFilter || item.adjustment_type === typeFilter
    
    // 사유 필터
    const matchesReason = !reasonFilter || item.adjustment_reason === reasonFilter

    return matchesSearch && matchesType && matchesReason
  })

  // 페이지네이션
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  // 통계 계산
  const increaseCount = filteredData.filter(item => item.adjustment_type === 'INCREASE' && !item.is_cancelled).length
  const decreaseCount = filteredData.filter(item => item.adjustment_type === 'DECREASE' && !item.is_cancelled).length
  const totalIncrease = filteredData
    .filter(item => item.adjustment_type === 'INCREASE' && !item.is_cancelled)
    .reduce((sum, item) => sum + (item.total_cost || 0), 0)
  const totalDecrease = filteredData
    .filter(item => item.adjustment_type === 'DECREASE' && !item.is_cancelled)
    .reduce((sum, item) => sum + (item.total_cost || 0), 0)

  // 취소 핸들러
  const handleCancel = async (adjustment: InventoryAdjustment) => {
    // 당일 체크 (시스템 관리자 제외)
    if (userRole !== '0000' && adjustment.adjustment_date !== today) {
      alert('당일 데이터만 취소할 수 있습니다.')
      return
    }

    const reason = prompt('취소 사유를 입력해주세요:')
    if (!reason || reason.trim() === '') {
      return
    }

    const ok = await confirm({ title: '조정 취소 확인', message: `재고 조정을 취소하시겠습니까?\n\n품목: ${adjustment.product_name}\n유형: ${typeLabels[adjustment.adjustment_type]}\n수량: ${adjustment.quantity} ${adjustment.unit}`, variant: 'danger' })
    if (!ok) return

    setIsCancelling(adjustment.id)

    const result = await cancelAdjustment({
      adjustment_id: adjustment.id,
      cancel_reason: reason
    })

    setIsCancelling(null)

    if (result.success) {
      alert(result.message)
      router.refresh()
    } else {
      alert(result.message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-3 sm:p-4 bg-white border-b flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            조정 내역
            {branchName && (
              <span className="ml-2 text-sm text-gray-900">({branchName})</span>
            )}
          </h2>
          <div className="text-sm text-gray-900">
            총 <span className="font-semibold text-blue-600">{filteredData.length}</span>건
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs text-green-600 font-medium">증가</div>
            <div className="text-lg font-bold text-green-700">{increaseCount}건</div>
            <div className="text-sm text-green-600">₩{totalIncrease.toLocaleString()}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-xs text-red-600 font-medium">감소</div>
            <div className="text-lg font-bold text-red-700">{decreaseCount}건</div>
            <div className="text-sm text-red-600">₩{totalDecrease.toLocaleString()}</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {/* 검색 */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="품목코드, 품목명 검색..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* 유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as AdjustmentType | '')
              setCurrentPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 유형</option>
            <option value="INCREASE">증가</option>
            <option value="DECREASE">감소</option>
          </select>

          {/* 사유 필터 */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value as AdjustmentReason | '')
              setCurrentPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 사유</option>
            {Object.entries(reasonLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 모바일 카드뷰 (767px 이하) */}
      <div className="md:hidden flex-1 overflow-y-auto bg-white">
        {paginatedData.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-900">
            {searchTerm ? '검색 결과가 없습니다.' : '조정 내역이 없습니다.'}
          </div>
        ) : (
          paginatedData.map((item) => (
            <div
              key={item.id}
              className={`p-4 border-b hover:bg-gray-50 ${item.is_cancelled ? 'bg-gray-100 opacity-60' : ''}`}
            >
              {/* 날짜 & 유형 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-900">{item.adjustment_date}</span>
                <Badge variant={item.adjustment_type === 'INCREASE' ? 'success' : 'danger'}>
                  {typeLabels[item.adjustment_type]}
                </Badge>
              </div>

              {/* 품목 */}
              <div className="font-medium text-gray-900 mb-1">
                {item.product_code} - {item.product_name}
              </div>

              {/* 사유 */}
              <div className="text-sm text-gray-900 mb-2">
                {reasonLabels[item.adjustment_reason]}
              </div>

              {/* 수량 & 원가 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">
                  수량: <span className="font-semibold">{item.quantity} {item.unit}</span>
                </span>
                {item.unit_cost > 0 && (
                  <span className="text-sm">
                    원가: ₩{item.unit_cost.toLocaleString()}
                  </span>
                )}
              </div>

              {/* 작성자 */}
              <div className="text-xs text-gray-900 mb-2">
                작성: {item.created_by_username}
              </div>

              {/* 취소 정보 */}
              {item.is_cancelled && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                  <div className="font-semibold">✕ 취소됨</div>
                  <div>{item.cancel_reason}</div>
                  <div className="text-gray-900">취소자: {item.cancelled_by_username}</div>
                </div>
              )}

              {/* 취소 버튼 */}
              {!item.is_cancelled && canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(item)}
                  disabled={isCancelling === item.id}
                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                >
                  {isCancelling === item.id ? '취소 중...' : '조정 취소'}
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 데스크톱 테이블 (768px 이상) */}
      <div className="hidden md:block flex-1 overflow-auto bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">날짜</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">품목코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">품목명</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">유형</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">사유</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">수량</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">단위원가</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">합계</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">작성자</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">상태</th>
              {canCancel && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase">작업</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={canCancel ? 11 : 10} className="px-4 py-12 text-center text-gray-900">
                  {searchTerm ? '검색 결과가 없습니다.' : '조정 내역이 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${item.is_cancelled ? 'bg-gray-100 opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {item.adjustment_date}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.product_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={item.adjustment_type === 'INCREASE' ? 'success' : 'danger'}>
                      {typeLabels[item.adjustment_type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-center">
                    {reasonLabels[item.adjustment_reason]}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {item.unit_cost > 0 ? `₩${item.unit_cost.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                    {item.total_cost > 0 ? `₩${item.total_cost.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.created_by_username}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_cancelled ? (
                      <div className="text-xs">
                        <div className="text-red-600 font-semibold">✕ 취소</div>
                        <div className="text-gray-900" title={item.cancel_reason || ''}>
                          {item.cancelled_by_username}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="default">정상</Badge>
                    )}
                  </td>
                  {canCancel && (
                    <td className="px-4 py-3 text-center">
                      {!item.is_cancelled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(item)}
                          disabled={isCancelling === item.id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          {isCancelling === item.id ? '처리중' : '취소'}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="p-4 bg-white border-t flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-900">
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} / {filteredData.length}
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            
            <span className="px-3 py-1 text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              다음
            </Button>
          </div>
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  )
}
