'use client'

/**
 * 입고 내역 테이블 (거래번호별 그룹화)
 */

import { useState, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import PurchaseDetailModal from './PurchaseDetailModal'
import type { PurchaseHistory, PurchaseGroup } from '@/types/purchases'

interface PurchaseHistoryTableProps {
  data: PurchaseHistory[]
  branchName: string | null
  userRole: string
  userId: string
  userBranchId: string
}

export default function PurchaseHistoryTable({ 
  data, 
  branchName, 
  userRole, 
  userId, 
  userBranchId 
}: PurchaseHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedGroup, setSelectedGroup] = useState<PurchaseGroup | null>(null)
  const itemsPerPage = 30

  const { can } = usePermissions(userRole)
  const canEdit = can('purchases_management', 'update')
  const canDelete = userRole <= '0002' && can('purchases_management', 'delete')

  // 거래번호별 그룹화
  const groupedData = useMemo(() => {
    const groups = new Map<string, PurchaseHistory[]>()
    
    data.forEach(item => {
      const key = item.reference_number || `NO_REF_${item.purchase_date}_${item.client_id}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })

    const result: PurchaseGroup[] = []
    groups.forEach((items, ref) => {
      const firstItem = items[0]
      result.push({
        reference_number: ref,
        purchase_date: firstItem.purchase_date,
        client_id: firstItem.client_id,
        client_name: firstItem.client_name,
        branch_id: firstItem.branch_id,
        branch_name: firstItem.branch_name,
        items: items,
        total_amount: items.reduce((sum, item) => sum + item.total_cost + (item.tax_amount || 0), 0),
        total_items: items.length,
        first_product_name: firstItem.product_name,
        created_at: firstItem.created_at,
        created_by: firstItem.created_by
      })
    })

    // 날짜 내림차순 정렬
    return result.sort((a, b) => 
      new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
    )
  }, [data])

  // 검색 + 날짜 필터링 (그룹 내부 품목도 검색)
  const filteredGroups = useMemo(() => {
    return groupedData.filter((group) => {
      // 날짜 필터
      let matchesDate = true
      if (startDate || endDate) {
        const groupDate = new Date(group.purchase_date).toISOString().split('T')[0]
        if (startDate && groupDate < startDate) matchesDate = false
        if (endDate && groupDate > endDate) matchesDate = false
      }
      
      if (!matchesDate) return false

      // 검색 필터 - 거래번호, 공급업체, 그룹 내 모든 품목 검색
      if (!searchTerm) return true
      
      const search = searchTerm.toLowerCase()
      const matchesGroupInfo = 
        (group.reference_number || '').toLowerCase().includes(search) ||
        (group.client_name || '').toLowerCase().includes(search)
      
      // 그룹 내부 품목 검색
      const matchesItems = group.items.some(item =>
        (item.product_code || '').toLowerCase().includes(search) ||
        (item.product_name || '').toLowerCase().includes(search)
      )
      
      return matchesGroupInfo || matchesItems
    })
  }, [groupedData, searchTerm, startDate, endDate])

  // 페이지네이션
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedGroups = filteredGroups.slice(startIndex, startIndex + itemsPerPage)

  // 총 금액 계산
  const totalAmount = filteredGroups.reduce((sum, group) => sum + group.total_amount, 0)
  const totalItems = filteredGroups.reduce((sum, group) => sum + group.total_items, 0)

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
            총 <span className="font-semibold text-blue-600">{filteredGroups.length}</span>건 
            (<span className="font-semibold text-green-600">{totalItems}</span>품목) |
            합계 <span className="font-semibold text-red-600">₩{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 필터 - 한 줄로 통합 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="품목코드, 품목명"
            className="flex-1 min-w-[300px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium whitespace-nowrap">시작일</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium whitespace-nowrap">종료일</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setStartDate(today)
              setEndDate(today)
              setCurrentPage(1)
            }}
            className="px-4 py-2.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap font-medium"
          >
            오늘
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
              setStartDate(firstDay.toISOString().split('T')[0])
              setEndDate(today.toISOString().split('T')[0])
              setCurrentPage(1)
            }}
            className="px-4 py-2.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition whitespace-nowrap font-medium"
          >
            이번달
          </button>
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setSearchTerm('')
              setCurrentPage(1)
            }}
            className="px-4 py-2.5 text-sm bg-gray-50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition whitespace-nowrap font-medium"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 모바일 카드뷰 (767px 이하) */}
      <div className="md:hidden flex-1 overflow-y-auto bg-white">
        {paginatedGroups.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '입고 내역이 없습니다.'}
          </div>
        ) : (
          paginatedGroups.map((group, index) => (
            <div key={`${group.reference_number}-${index}`} className="p-3 border-b hover:bg-gray-50 transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-blue-600">
                    {group.reference_number?.startsWith('NO_REF_') ? '(없음)' : (group.reference_number || '(없음)')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(group.purchase_date).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <p className="text-gray-600">공급업체</p>
                  <p className="font-medium text-gray-900">{group.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">품목</p>
                  <p className="font-medium text-gray-900">
                    {group.first_product_name}
                    {group.total_items > 1 && <span className="text-blue-600"> 외 {group.total_items - 1}개</span>}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">품목 수</p>
                  <p className="font-medium text-gray-900">{group.total_items}개</p>
                </div>
                <div>
                  <p className="text-gray-600">총액</p>
                  <p className="font-bold text-blue-700">₩{group.total_amount.toLocaleString()}</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedGroup(group)}
                className="w-full"
              >
                상세보기
              </Button>
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
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                거래번호
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                입고일
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                공급업체
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                품목
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                금액
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                부가세포함
              </th>
              <th className="px-5 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                상세
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedGroups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '입고 내역이 없습니다.'}
                </td>
              </tr>
            ) : (
              paginatedGroups.map((group, index) => (
                <tr key={`${group.reference_number}-${index}`} className="hover:bg-gray-50">
                  <td 
                    className="px-3 py-1.5 text-sm text-center font-medium text-blue-600 cursor-pointer hover:underline"
                    onClick={() => setSelectedGroup(group)}
                  >
                    {group.reference_number?.startsWith('NO_REF_') ? '(없음)' : (group.reference_number || '(없음)')}
                  </td>
                  <td className="px-3 py-1.5 text-sm text-center text-gray-900">
                    {new Date(group.purchase_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-3 py-1.5 text-sm text-center text-gray-600">
                    {group.client_name}
                  </td>
                  <td className="px-4 py-1.5 text-sm text-center text-gray-900">
                    {group.first_product_name}
                    {group.total_items > 1 && (
                      <span className="text-blue-600 font-medium"> 외 {group.total_items - 1}개</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-sm text-center font-semibold text-blue-600">
                    ₩{group.total_amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="text-green-600 font-medium">✓</span>
                  </td>
                  <td className="px-5 py-1.5 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGroup(group)}
                    >
                      상세보기
                    </Button>
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
            전체 {filteredGroups.length}건 ({filteredData.length}품목) 중 {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredGroups.length)}건 표시
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

      {/* 상세보기 모달 */}
      {selectedGroup && (
        <PurchaseDetailModal
          referenceNumber={selectedGroup.reference_number}
          items={selectedGroup.items}
          onClose={() => setSelectedGroup(null)}
          userRole={userRole}
          userId={userId}
          userBranchId={userBranchId}
        />
      )}
    </div>
  )
}