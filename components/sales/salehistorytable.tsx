'use client'

/**
 * 판매 내역 테이블 (Phase 3.5: 수정/삭제 기능 추가)
 * 입고 내역(PurchaseHistoryTable) 구조 100% 적용
 */

import { useState, useMemo, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { updateSale, deleteSale } from '@/app/sales/actions'
import { Button } from '@/components/ui/Button'
import EditSaleModal from './EditSaleModal'
import { StatCard } from '@/components/shared/StatCard'
import type { SaleHistory } from '@/types/sales'

interface Props {
  data: SaleHistory[]
  branchName: string
  userRole: string
  userId: string
  userBranchId: string
}

export default function SaleHistoryTable({ 
  data: initialData, 
  branchName,
  userRole,
  userId,
  userBranchId
}: Props) {
  const [data, setData] = useState<SaleHistory[]>(initialData)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Phase 3.5: 편집/삭제 상태
  const [editingSale, setEditingSale] = useState<SaleHistory | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { can } = usePermissions(userRole)

  // 편집 권한: 모든 역할
  const canEdit = can('sales_management', 'update')
  
  // 삭제 권한: 원장 이상 (0000~0002)
  const canDelete = userRole <= '0002' && can('sales_management', 'delete')

  // 초기 데이터 업데이트
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  // 검색 필터링
  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    const search = searchTerm.toLowerCase()
    return data.filter(
      (item) =>
        (item.product_code || '').toLowerCase().includes(search) ||
        (item.product_name || '').toLowerCase().includes(search) ||
        (item.customer_name || '').toLowerCase().includes(search) ||
        (item.reference_number || '').toLowerCase().includes(search)
    )
  }, [data, searchTerm])

  // 페이지네이션
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage])

  // 페이지 변경 시 스크롤 최상단
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 통계 계산
  const stats = useMemo(() => {
    const totalQuantity = filteredData.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const totalAmount = filteredData.reduce((sum, item) => sum + (item.total_amount || 0), 0)
    const totalCost = filteredData.reduce((sum, item) => sum + (item.cost_of_goods || 0), 0)
    const totalProfit = filteredData.reduce((sum, item) => sum + (item.profit || 0), 0)
    const avgProfitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0

    return {
      count: filteredData.length,
      totalQuantity,
      totalAmount,
      totalCost,
      totalProfit,
      avgProfitMargin
    }
  }, [filteredData])

  // Phase 3.5: 판매 수정 핸들러
  const handleEdit = async (editData: {
    quantity: number
    unit_price: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }) => {
    if (!editingSale) return

    const result = await updateSale({
      sale_id: editingSale.id,
      user_id: userId,
      user_role: userRole,
      user_branch_id: userBranchId,
      ...editData
    })

    if (result.success) {
      alert(result.message)
      window.location.reload()
    } else {
      alert(result.message)
    }
  }

  // Phase 3.5: 판매 삭제 핸들러
  const handleDelete = async (sale: SaleHistory) => {
    if (!confirm(`판매 데이터를 삭제하시겠습니까?\n\n품목: ${sale.product_name}\n수량: ${sale.quantity} ${sale.unit}\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    setIsDeleting(sale.id)

    const result = await deleteSale({
      sale_id: sale.id,
      user_id: userId,
      user_role: userRole,
      user_branch_id: userBranchId
    })

    setIsDeleting(null)

    if (result.success) {
      alert(result.message)
      window.location.reload()
    } else {
      alert(result.message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">판매 내역</h3>
            <p className="text-sm text-gray-600 mt-1">{branchName}</p>
          </div>
          <div className="w-full sm:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="품목코드, 품명, 고객, 참조번호 검색..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="판매 건수" value={stats.count} unit="건" variant="primary" />
          <StatCard label="판매 수량" value={stats.totalQuantity} variant="primary" />
          <StatCard label="판매 금액" value={`₩${stats.totalAmount.toLocaleString()}`} variant="primary" />
          <StatCard label="총 이익" value={`₩${stats.totalProfit.toLocaleString()}`} variant="success" />
          <StatCard label="평균 이익률" value={`${stats.avgProfitMargin.toFixed(1)}%`} variant="success" />
        </div>
      </div>

      {/* 모바일 카드뷰 (767px 이하) */}
      <div className="md:hidden flex-1 overflow-y-auto bg-white">
        {paginatedData.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '판매 내역이 없습니다.'}
          </div>
        ) : (
          paginatedData.map((item, index) => (
            <div key={`${item.id}-${index}`} className="p-4 hover:bg-gray-50 transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-medium text-blue-600">{item.product_code}</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{item.product_name}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(item.sale_date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">고객</p>
                  <p className="font-medium text-gray-900">{item.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">수량</p>
                  <p className="font-medium text-gray-900">{(item.quantity || 0).toLocaleString()} {item.unit}</p>
                </div>
                <div>
                  <p className="text-gray-600">합계</p>
                  <p className="font-bold text-blue-700">₩{(item.total_amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">이익</p>
                  <p className={`font-bold ${(item.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₩{(item.profit || 0).toLocaleString()} ({(item.profit_margin || 0).toFixed(1)}%)
                  </p>
                </div>
              </div>
              
              {item.reference_number && (
                <p className="mt-2 text-xs text-gray-500">참조: {item.reference_number}</p>
              )}

              {/* Phase 3.5: 모바일 수정/삭제 버튼 */}
              {(canEdit || canDelete) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {canEdit && (
                    <Button
                      onClick={() => setEditingSale(item)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      수정
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      onClick={() => handleDelete(item)}
                      disabled={isDeleting === item.id}
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {isDeleting === item.id ? '삭제 중...' : '삭제'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 데스크톱 테이블 (768px 이상) */}
      <div className="hidden md:block flex-1 overflow-y-auto bg-white">
        <div className="overflow-x-auto min-h-0">
        <table className="min-w-full min-w-[1000px] divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                판매일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                품목코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                품목명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                고객
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                단위
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                수량
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                단가
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                판매금액
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                원가
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                이익
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                이익률
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                참조번호
              </th>
              {/* Phase 3.5: 작업 컬럼 */}
              {(canEdit || canDelete) && (
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  작업
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={canEdit || canDelete ? 13 : 12} className="px-4 py-12 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '판매 내역이 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={`${item.id}-${index}`}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(item.sale_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">
                    {item.product_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.customer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700 font-medium">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {(item.quantity || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    ₩{(item.unit_price || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                    ₩{(item.total_amount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    ₩{(item.cost_of_goods || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                    ₩{(item.profit || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-700">
                    {(item.profit_margin || 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.reference_number || '-'}
                  </td>
                  {/* Phase 3.5: 작업 셀 */}
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <Button
                            onClick={() => setEditingSale(item)}
                            size="sm"
                            variant="outline"
                          >
                            수정
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            onClick={() => handleDelete(item)}
                            disabled={isDeleting === item.id}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            {isDeleting === item.id ? '삭제 중...' : '삭제'}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-white flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600 text-center sm:text-left">
            전체 {filteredData.length}건 중 {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredData.length)}건 표시
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              이전
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 2
                )
                .map((page, index, array) => (
                  <div key={page} className="flex items-center">
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm border rounded-lg transition ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Phase 3.5: 판매 수정 모달 */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  )
}