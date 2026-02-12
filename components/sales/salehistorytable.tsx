'use client'

/**
 * 판매 내역 테이블 (거래번호별 그룹화)
 * @tanstack/react-table 기반
 */

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { usePermissions } from '@/hooks/usePermissions'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import SaleDetailModal from './SaleDetailModal'
import type { SaleHistory, SaleGroup, ProductWithStock } from '@/types/sales'

interface SaleHistoryTableProps {
  data: SaleHistory[]
  products: ProductWithStock[]
  branchName: string | null
  userRole: string
  userId: string
  userBranchId: string
  transactionType?: 'SALE' | 'USAGE'
}

const columnHelper = createColumnHelper<SaleGroup>()

export default function SaleHistoryTable({
  data,
  products,
  branchName,
  userRole,
  userId,
  userBranchId,
  transactionType = 'SALE'
}: SaleHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<SaleGroup | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const { can } = usePermissions(userRole)
  const isUsage = transactionType === 'USAGE'
  const label = isUsage ? '사용' : '판매'

  // 거래번호별 그룹화
  const groupedData = useMemo(() => {
    const groups = new Map<string, SaleHistory[]>()

    data.forEach(item => {
      const key = item.reference_number || `NO_REF_${item.sale_date}_${item.customer_name}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })

    const result: SaleGroup[] = []
    groups.forEach((items, ref) => {
      const firstItem = items[0]
      const totalAmount = items.reduce((sum, item) => sum + (item.total_amount || 0), 0)

      result.push({
        reference_number: ref,
        sale_date: firstItem.sale_date,
        branch_id: firstItem.branch_id,
        client_id: firstItem.client_id,
        customer_name: firstItem.customer_name,
        items: items,
        total_amount: totalAmount,
        total_items: items.length,
        first_product_name: firstItem.product_name
      })
    })

    return result.sort((a, b) =>
      new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    )
  }, [data])

  // 검색 + 날짜 필터링
  const filteredGroups = useMemo(() => {
    return groupedData.filter((group) => {
      let matchesDate = true
      if (startDate || endDate) {
        const groupDate = new Date(group.sale_date).toISOString().split('T')[0]
        if (startDate && groupDate < startDate) matchesDate = false
        if (endDate && groupDate > endDate) matchesDate = false
      }
      if (!matchesDate) return false

      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      const matchesGroupInfo =
        (group.reference_number || '').toLowerCase().includes(search) ||
        (group.customer_name || '').toLowerCase().includes(search)
      const matchesItems = group.items.some(item =>
        (item.product_code || '').toLowerCase().includes(search) ||
        (item.product_name || '').toLowerCase().includes(search) ||
        (item.notes || '').toLowerCase().includes(search)
      )
      return matchesGroupInfo || matchesItems
    })
  }, [groupedData, searchTerm, startDate, endDate])

  // 총 금액
  const totalAmount = filteredGroups.reduce((sum, g) => sum + g.total_amount, 0)
  const totalItems = filteredGroups.reduce((sum, g) => sum + g.total_items, 0)

  const columns = [
    columnHelper.accessor('reference_number', {
      header: '거래번호',
      size: 140,
      cell: (info) => {
        const val = info.getValue()
        return (
          <span
            className="font-medium text-blue-600 cursor-pointer hover:underline truncate block" style={{ fontSize: '13px' }}
            onClick={() => setSelectedGroup(info.row.original)}
          >
            {val?.startsWith('NO_REF_') ? '(없음)' : (val || '(없음)')}
          </span>
        )
      },
    }),
    columnHelper.accessor('first_product_name', {
      header: '품목',
      size: 240,
      cell: (info) => {
        const group = info.row.original
        return (
          <span className="text-sm text-gray-900 truncate block">
            {info.getValue()}
            {group.total_items > 1 && (
              <span className="text-blue-600 font-medium"> 외 {group.total_items - 1}개</span>
            )}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'supply_price',
      header: '공급가',
      size: 120,
      cell: (info) => {
        const supply = info.row.original.items.reduce((sum, item) => sum + (item.supply_price || 0), 0)
        return <span className="text-sm text-gray-900">₩{supply.toLocaleString()}</span>
      },
    }),
    columnHelper.display({
      id: 'tax_amount',
      header: '부가세',
      size: 110,
      cell: (info) => {
        const tax = info.row.original.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0)
        return <span className="text-sm text-orange-600">₩{tax.toLocaleString()}</span>
      },
    }),
    columnHelper.accessor('total_amount', {
      header: '금액',
      size: 130,
      cell: (info) => (
        <span className="text-sm font-semibold text-blue-600">
          ₩{info.getValue().toLocaleString()}
        </span>
      ),
    }),
    columnHelper.accessor('customer_name', {
      header: '거래처',
      size: 150,
      cell: (info) => (
        <span className="text-sm text-gray-700 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '상세',
      size: 90,
      enableSorting: false,
      cell: (info) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedGroup(info.row.original)}
        >
          상세보기
        </Button>
      ),
    }),
  ]

  const table = useReactTable({
    data: filteredGroups,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 30 },
    },
  })

  return (
    <div className="flex flex-col h-full">
      <ContentCard className="flex flex-col h-full !p-0">
        {/* 헤더 + 필터 */}
        <div className="p-3 sm:p-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {label} 내역
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

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="거래처, 품목코드, 품목명, 비고"
              className="flex-1 min-w-[300px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium whitespace-nowrap">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium whitespace-nowrap">종료일</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                setStartDate(today)
                setEndDate(today)
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
              }}
              className="px-4 py-2.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition whitespace-nowrap font-medium"
            >
              이번달
            </button>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm('') }}
              className="px-4 py-2.5 text-sm bg-gray-50 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition whitespace-nowrap font-medium"
            >
              초기화
            </button>
          </div>
        </div>

        {/* 페이지네이션 */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0">
            <div className="flex items-center gap-1">
              <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">«</button>
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">‹</button>
              {generatePageNumbers(table.getState().pagination.pageIndex, table.getPageCount()).map((page, i) =>
                page === -1 ? (
                  <span key={`e-${i}`} className="px-2 text-sm text-gray-400">…</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition ${
                      table.getState().pagination.pageIndex === page
                        ? 'bg-blue-600 text-white font-medium'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page + 1}
                  </button>
                )
              )}
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">›</button>
              <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">»</button>
            </div>
            <span className="text-sm text-gray-600">
              총 {filteredGroups.length}건 중 {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredGroups.length)}건 표시
            </span>
          </div>
        )}

        {/* 모바일 카드뷰 */}
        <div className="md:hidden flex-1 overflow-y-auto">
          {table.getRowModel().rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              {searchTerm ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
            </div>
          ) : (
            table.getRowModel().rows.map((row) => {
              const group = row.original
              return (
                <div key={row.id} className="p-3 border-b hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-blue-600">
                        {group.reference_number?.startsWith('NO_REF_') ? '(없음)' : (group.reference_number || '(없음)')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(group.sale_date).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">거래처</p>
                      <p className="font-medium text-gray-900">{group.customer_name}</p>
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
                  <Button variant="outline" size="sm" onClick={() => setSelectedGroup(group)} className="w-full">
                    상세보기
                  </Button>
                </div>
              )
            })
          )}
        </div>

        {/* 데스크톱 테이블 */}
        <div className="hidden md:block flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed">
              <colgroup>
                {table.getAllColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      return (
                        <th
                          key={header.id}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center ${
                            canSort ? 'cursor-pointer select-none hover:bg-gray-100 transition' : ''
                          }`}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && (
                              <span className="text-gray-400">
                                {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ' ↕'}
                              </span>
                            )}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-center">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ContentCard>

      {/* 상세보기 모달 */}
      {selectedGroup && (
        <SaleDetailModal
          referenceNumber={selectedGroup.reference_number}
          items={selectedGroup.items}
          products={products}
          onClose={() => setSelectedGroup(null)}
          userRole={userRole}
          userId={userId}
          userBranchId={userBranchId}
        />
      )}
    </div>
  )
}

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: number[] = [0]
  if (current > 2) pages.push(-1)
  const start = Math.max(1, current - 1)
  const end = Math.min(total - 2, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 3) pages.push(-1)
  pages.push(total - 1)
  return pages
}
