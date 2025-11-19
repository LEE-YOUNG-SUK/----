'use client'

/**
 * 판매 내역 테이블
 * 입고 내역(PurchaseHistoryTable) 구조 100% 적용
 */

import { useState, useMemo, useEffect } from 'react'
import type { SaleHistory } from '@/types/sales'

interface Props {
  data: SaleHistory[]
  branchName: string
}

export default function SaleHistoryTable({ data: initialData, branchName }: Props) {
  const [data, setData] = useState<SaleHistory[]>(initialData)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

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
        item.product_code.toLowerCase().includes(search) ||
        item.product_name.toLowerCase().includes(search) ||
        item.customer_name.toLowerCase().includes(search) ||
        (item.reference_number && item.reference_number.toLowerCase().includes(search))
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
    const totalQuantity = filteredData.reduce((sum, item) => sum + item.quantity, 0)
    const totalAmount = filteredData.reduce((sum, item) => sum + item.total_amount, 0)
    const totalCost = filteredData.reduce((sum, item) => sum + item.cost_of_goods, 0)
    const totalProfit = filteredData.reduce((sum, item) => sum + item.profit, 0)
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

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">판매 내역</h3>
            <p className="text-sm text-gray-600 mt-1">{branchName}</p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="품목코드, 품명, 고객, 참조번호 검색..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
            />
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-gray-600">판매 건수</p>
            <p className="text-lg font-bold text-blue-600">{stats.count.toLocaleString()}건</p>
          </div>
          <div>
            <p className="text-gray-600">판매 수량</p>
            <p className="text-lg font-bold text-blue-600">{stats.totalQuantity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">판매 금액</p>
            <p className="text-lg font-bold text-blue-600">₩{stats.totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">총 이익</p>
            <p className="text-lg font-bold text-green-600">₩{stats.totalProfit.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">평균 이익률</p>
            <p className="text-lg font-bold text-green-600">{stats.avgProfitMargin.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
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
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    ₩{item.unit_price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-blue-700">
                    ₩{item.total_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    ₩{item.cost_of_goods.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                    ₩{item.profit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-700">
                    {item.profit_margin.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.reference_number || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            전체 {filteredData.length}건 중 {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredData.length)}건 표시
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className={`px-3 py-1 border rounded ${
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
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}