'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { getMovementHistory } from '@/app/inventory/movements/actions'
import { getPurchasesByReferenceNumber, getSalesByReferenceNumber } from '@/app/inventory/actions'
import type { InventoryMovement } from '@/types/inventory'
import type { UserData, Product } from '@/types'
import type { PurchaseHistory } from '@/types/purchases'
import type { SaleHistory } from '@/types/sales'
import dynamic from 'next/dynamic'

const PurchaseDetailModal = dynamic(() => import('@/components/purchases/PurchaseDetailModal'), { ssr: false })
const SaleDetailModal = dynamic(() => import('@/components/sales/SaleDetailModal'), { ssr: false })

interface InventoryItem {
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  category: string | null
  current_quantity: number
  layer_count: number
  oldest_purchase_date: string | null
  newest_purchase_date: string | null
  avg_unit_cost: number | null
  min_stock_level?: number
}

interface Props {
  item: InventoryItem
  startDate?: string
  endDate?: string
  onClose: () => void
  userSession?: UserData
  products?: Product[]
}

export function InventoryLayerModal({ item, startDate, endDate, onClose, userSession, products }: Props) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // 수정 모달 상태
  const [purchaseModal, setPurchaseModal] = useState<{ referenceNumber: string; items: PurchaseHistory[] } | null>(null)
  const [saleModal, setSaleModal] = useState<{ referenceNumber: string; items: SaleHistory[] } | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // 드래그 상태
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetSnap = useRef({ x: 0, y: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, select, textarea, a')) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    offsetSnap.current = { ...offsetRef.current }
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const newOffset = {
        x: offsetSnap.current.x + (e.clientX - dragStart.current.x),
        y: offsetSnap.current.y + (e.clientY - dragStart.current.y),
      }
      offsetRef.current = newOffset
      setOffset(newOffset)
    }
    const onUp = () => { dragging.current = false }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [])

  useEffect(() => {
    loadMovements()
  }, [item])

  const loadMovements = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getMovementHistory({
        branchId: item.branch_id,
        productIds: [item.product_id],
        startDate: startDate || new Date(new Date().getFullYear(), 0, 1).toLocaleDateString('sv-SE'),
        endDate: endDate || new Date().toLocaleDateString('sv-SE'),
      })

      if (!result.success) throw new Error(result.message || '조회 실패')

      // 단일 품목 조회이므로 첫 번째 그룹의 movements 사용
      const firstGroup = result.data[0]
      setMovements(firstGroup?.movements || [])
    } catch (err: any) {
      console.error('입출고 내역 조회 실패:', err)
      setError(err.message || '입출고 내역을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 행 클릭 핸들러
  const handleRowClick = async (m: InventoryMovement) => {
    if (!m.reference_number || m.movement_type === '전일재고') return
    if (m.movement_type.startsWith('조정')) return

    setModalLoading(true)
    try {
      if (m.movement_type === '입고') {
        const result = await getPurchasesByReferenceNumber(m.reference_number, item.branch_id)
        if (result.success && result.data.length > 0) {
          setPurchaseModal({ referenceNumber: m.reference_number, items: result.data })
        } else {
          alert('입고 상세 데이터를 찾을 수 없습니다.')
        }
      } else if (m.movement_type === '출고') {
        const result = await getSalesByReferenceNumber(m.reference_number, item.branch_id)
        if (result.success && result.data.length > 0) {
          setSaleModal({ referenceNumber: m.reference_number, items: result.data })
        } else {
          alert('판매 상세 데이터를 찾을 수 없습니다.')
        }
      }
    } catch (err) {
      console.error('상세 조회 실패:', err)
      alert('상세 데이터 조회 중 오류가 발생했습니다.')
    } finally {
      setModalLoading(false)
    }
  }

  const isClickable = (m: InventoryMovement) => {
    if (!userSession || !products) return false
    return m.reference_number && m.movement_type !== '전일재고' && !m.movement_type.startsWith('조정')
  }

  const filteredMovements = useMemo(() => {
    if (!searchTerm.trim()) return movements
    const term = searchTerm.trim().toLowerCase()
    return movements.filter(
      (m) =>
        (m.party_name && m.party_name.toLowerCase().includes(term)) ||
        (m.remarks && m.remarks.toLowerCase().includes(term))
    )
  }, [movements, searchTerm])

  // 월별 소계가 포함된 테이블 행 생성
  type TableRow =
    | { type: 'movement'; data: InventoryMovement; index: number }
    | { type: 'subtotal'; monthLabel: string; totalIn: number; totalOut: number; endBalance: number }

  const rowsWithSubtotals = useMemo((): TableRow[] => {
    if (filteredMovements.length === 0) return []

    const rows: TableRow[] = []
    let currentMonth = ''
    let monthIn = 0
    let monthOut = 0
    let monthEndBalance = 0

    filteredMovements.forEach((m, index) => {
      const date = new Date(m.movement_date)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      // 월이 바뀌면 이전 월 소계 추가
      if (currentMonth && month !== currentMonth) {
        const [y, mo] = currentMonth.split('-')
        rows.push({
          type: 'subtotal',
          monthLabel: `${y}년 ${Number(mo)}월 소계`,
          totalIn: monthIn,
          totalOut: monthOut,
          endBalance: monthEndBalance,
        })
        monthIn = 0
        monthOut = 0
      }

      currentMonth = month
      monthIn += Number(m.incoming_qty)
      monthOut += Number(m.outgoing_qty)
      monthEndBalance = Number(m.running_balance)

      rows.push({ type: 'movement', data: m, index })
    })

    // 마지막 월 소계 추가
    if (currentMonth) {
      const [y, mo] = currentMonth.split('-')
      rows.push({
        type: 'subtotal',
        monthLabel: `${y}년 ${Number(mo)}월 소계`,
        totalIn: monthIn,
        totalOut: monthOut,
        endBalance: monthEndBalance,
      })
    }

    return rows
  }, [filteredMovements])

  const totals = useMemo(() => ({
    totalIn: movements.reduce((sum, m) => sum + Number(m.incoming_qty), 0),
    totalOut: movements.reduce((sum, m) => sum + Number(m.outgoing_qty), 0),
  }), [movements])

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-900 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ resize: 'both', minWidth: 320, minHeight: 200 }}>

          {/* 헤더 (드래그 핸들) */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 cursor-grab active:cursor-grabbing select-none" onPointerDown={onPointerDown}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  재고 입출고 내역
                </h2>
                <p className="text-sm text-gray-900 mt-1">
                  {item.product_code} - {item.product_name}
                  {startDate && endDate && (
                    <span className="ml-2 text-gray-800">({startDate} ~ {endDate})</span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-800 hover:text-gray-900 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 요약 정보 */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-blue-600 mb-1">지점</p>
                <p className="font-semibold text-blue-900">{item.branch_name}</p>
              </div>
              <div>
                <p className="text-blue-600 mb-1">현재 재고</p>
                <p className="font-semibold text-blue-900">
                  {item.current_quantity.toLocaleString()} {item.unit}
                </p>
              </div>
              <div>
                <p className="text-blue-600 mb-1">총 입고</p>
                <p className="font-semibold text-blue-600">
                  {totals.totalIn.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-blue-600 mb-1">총 출고</p>
                <p className="font-semibold text-red-600">
                  {totals.totalOut.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* 검색 필터 */}
          {!loading && !error && movements.length > 0 && (
            <div className="px-6 pt-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="거래처 또는 비고 검색..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          )}

          {/* 입출고 내역 테이블 */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-900">데이터 로딩 중...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {!loading && !error && movements.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-900">입출고 내역이 없습니다.</p>
              </div>
            )}

            {!loading && !error && movements.length > 0 && filteredMovements.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-900">검색 결과가 없습니다.</p>
              </div>
            )}

            {!loading && !error && filteredMovements.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">일자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">거래처명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase">비고</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">입고수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">출고수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase">재고수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rowsWithSubtotals.map((row, idx) => {
                      if (row.type === 'subtotal') {
                        return (
                          <tr key={`sub-${idx}`} className="bg-amber-50 border-t border-b border-amber-200">
                            <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-amber-800 text-right">
                              {row.monthLabel}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-blue-700">
                              {row.totalIn > 0 ? row.totalIn.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-red-700">
                              {row.totalOut > 0 ? row.totalOut.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-amber-900">
                              {row.endBalance.toLocaleString()}
                            </td>
                          </tr>
                        )
                      }
                      const m = row.data
                      const clickable = isClickable(m)
                      return (
                        <tr
                          key={row.index}
                          className={`hover:bg-gray-50 ${clickable ? 'cursor-pointer' : ''}`}
                          onClick={clickable ? () => handleRowClick(m) : undefined}
                        >
                          <td className="px-4 py-3 text-sm">
                            {clickable ? (
                              <span className={`font-medium underline ${m.movement_type === '입고' ? 'text-blue-600' : 'text-red-600'}`}>
                                {new Date(m.movement_date).toLocaleDateString('ko-KR')}
                              </span>
                            ) : (
                              <span className="text-gray-900">
                                {new Date(m.movement_date).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {m.party_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                            {m.remarks || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {Number(m.incoming_qty) > 0 ? (
                              <span className="font-semibold text-blue-600">
                                {Number(m.incoming_qty).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {Number(m.outgoing_qty) > 0 ? (
                              <span className="font-semibold text-red-600">
                                {Number(m.outgoing_qty).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {Number(m.running_balance).toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        합계
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">
                        {totals.totalIn.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                        {totals.totalOut.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {filteredMovements.length > 0 ? Number(filteredMovements[filteredMovements.length - 1].running_balance).toLocaleString() : 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* 로딩 오버레이 */}
          {modalLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <p className="text-xs text-gray-800">입고/출고 일자를 클릭하면 상세 수정 모달이 열립니다</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
            >
              닫기
            </button>
          </div>

        </div>
      </div>

      {/* 입고 수정 모달 */}
      {purchaseModal && userSession && products && (
        <PurchaseDetailModal
          referenceNumber={purchaseModal.referenceNumber}
          items={purchaseModal.items}
          products={products}
          onClose={() => {
            setPurchaseModal(null)
            loadMovements()
          }}
          userRole={userSession.role}
          userId={userSession.user_id}
          userBranchId={userSession.branch_id || ''}
        />
      )}

      {/* 판매 수정 모달 */}
      {saleModal && userSession && products && (
        <SaleDetailModal
          referenceNumber={saleModal.referenceNumber}
          items={saleModal.items}
          products={products as any}
          onClose={() => {
            setSaleModal(null)
            loadMovements()
          }}
          userRole={userSession.role}
          userId={userSession.user_id}
          userBranchId={userSession.branch_id || ''}
        />
      )}
    </>
  )
}
