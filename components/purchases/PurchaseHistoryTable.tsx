'use client'

/**
 * 입고 내역 테이블
 */

import { useState } from 'react'
import type { PurchaseHistory } from '@/types/purchases'

interface PurchaseHistoryTableProps {
  data: PurchaseHistory[]
  branchName: string | null
}

export default function PurchaseHistoryTable({ data, branchName }: PurchaseHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // 검색 필터링
  const filteredData = data.filter(
    (item) =>
      item.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reference_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 페이지네이션
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  // 총 금액 계산
  const totalAmount = filteredData.reduce((sum, item) => sum + item.total_cost, 0)

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            입고 내역
            {branchName && (
              <span className="ml-2 text-sm text-gray-500">({branchName})</span>
            )}
          </h2>
          <div className="text-sm text-gray-600">
            총 <span className="font-semibold text-blue-600">{filteredData.length}</span>건 |
            합계 <span className="font-semibold text-red-600">₩{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 검색 */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentPage(1)
          }}
          placeholder="품목코드, 품목명, 공급업체, 참조번호 검색..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                입고일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                품목코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                품목명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                공급업체
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
                합계
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                참조번호
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '입고 내역이 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(item.purchase_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">
                    {item.product_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.client_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-600">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    ₩{item.unit_cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                    ₩{item.total_cost.toLocaleString()}
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
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}