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
      (item.product_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 페이지네이션
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  // 총 금액 계산
  const totalAmount = filteredData.reduce((sum, item) => sum + item.total_cost, 0)

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-3 sm:p-4 bg-white border-b flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
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

      {/* 모바일 카드뷰 (767px 이하) */}
      <div className="md:hidden flex-1 overflow-y-auto bg-white">
        {paginatedData.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '입고 내역이 없습니다.'}
          </div>
        ) : (
          paginatedData.map((item, index) => (
            <div key={`${item.id}-${item.product_id}-${index}`} className="p-4 hover:bg-gray-50 transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-medium text-blue-600">{item.product_code}</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{item.product_name}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(item.purchase_date).toLocaleDateString('ko-KR')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">공급업체</p>
                  <p className="font-medium text-gray-900">{item.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">수량</p>
                  <p className="font-medium text-gray-900">{item.quantity.toLocaleString()} {item.unit}</p>
                </div>
                <div>
                  <p className="text-gray-600">단가</p>
                  <p className="text-gray-900">₩{item.unit_cost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">합계</p>
                  <p className="font-bold text-blue-700">₩{item.total_cost.toLocaleString()}</p>
                </div>
              </div>
              
              {item.reference_number && (
                <p className="mt-2 text-xs text-gray-500">참조: {item.reference_number}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* 데스크톱 테이블 (768px 이상) */}
      <div className="hidden md:block flex-1 overflow-y-auto bg-white">
        <div className="overflow-x-auto min-h-0">
          <table className="w-full min-w-[800px]">
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
              paginatedData.map((item, index) => (
                <tr key={`${item.id}-${item.product_id}-${index}`} className="hover:bg-gray-50">
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
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              이전
            </button>
            <span className="px-3 py-2 text-sm font-medium text-gray-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}