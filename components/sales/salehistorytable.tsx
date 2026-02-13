'use client'

/**
 * 판매 내역 테이블 (거래번호별 그룹화)
 * @tanstack/react-table 기반
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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
import { validateDateRange } from '@/lib/date-utils'

interface SaleHistoryTableProps {
  data: SaleHistory[]
  products: ProductWithStock[]
  branchName: string | null
  userRole: string
  userId: string
  userBranchId: string
  transactionType?: 'SALE' | 'USAGE'
}

type ViewMode = 'transaction' | 'product'

const columnHelper = createColumnHelper<SaleGroup>()
const itemColumnHelper = createColumnHelper<SaleHistory>()

export default function SaleHistoryTable({
  data,
  products,
  branchName,
  userRole,
  userId,
  userBranchId,
  transactionType = 'SALE'
}: SaleHistoryTableProps) {
  // 초기 날짜: 오늘 - 30일 ~ 오늘
  const initialDates = useMemo(() => {
    const today = new Date()
    const ago = new Date(today)
    ago.setDate(ago.getDate() - 30)
    return {
      start: ago.toLocaleDateString('sv-SE'),
      end: today.toLocaleDateString('sv-SE'),
    }
  }, [])

  // 입력 상태 (드래프트)
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [startDate, setStartDate] = useState(initialDates.start)
  const [endDate, setEndDate] = useState(initialDates.end)

  // 적용된 필터 (검색 버튼 클릭 시 반영)
  const [appliedProduct, setAppliedProduct] = useState('')
  const [appliedCustomer, setAppliedCustomer] = useState('')
  const [appliedStartDate, setAppliedStartDate] = useState(initialDates.start)
  const [appliedEndDate, setAppliedEndDate] = useState(initialDates.end)

  // 지점 필터 (관리자용)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [appliedBranch, setAppliedBranch] = useState('')

  const [selectedGroup, setSelectedGroup] = useState<SaleGroup | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [viewMode, setViewMode] = useState<ViewMode>('transaction')
  const [itemSorting, setItemSorting] = useState<SortingState>([])

  // 지점 목록 추출 (관리자용)
  const branchOptions = useMemo(() => {
    if (userRole !== '0000') return []
    const map = new Map<string, string>()
    data.forEach(item => {
      if (item.branch_id && item.branch_name) map.set(item.branch_id, item.branch_name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data, userRole])

  // 품목 자동완성 상태
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const productInputRef = useRef<HTMLInputElement>(null)
  const productDropdownRef = useRef<HTMLDivElement>(null)

  const { can } = usePermissions(userRole)
  const isUsage = transactionType === 'USAGE'
  const label = isUsage ? '사용' : '판매'

  // 품목 자동완성 필터 목록
  const filteredProductOptions = useMemo(() => {
    if (productSearch.length < 1) return []
    const search = productSearch.toLowerCase()
    return products
      .filter(p => p.code.toLowerCase().includes(search) || p.name.toLowerCase().includes(search))
      .slice(0, 10)
  }, [productSearch, products])

  useEffect(() => {
    setShowProductDropdown(filteredProductOptions.length > 0 && productSearch.length >= 1)
    setSelectedProductIndex(0)
  }, [filteredProductOptions, productSearch])

  // 드롭다운 스크롤 추적
  useEffect(() => {
    if (showProductDropdown && productDropdownRef.current) {
      const el = productDropdownRef.current.children[selectedProductIndex] as HTMLElement
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedProductIndex, showProductDropdown])

  const handleProductSelect = useCallback((product: ProductWithStock) => {
    setProductSearch(product.name)
    setShowProductDropdown(false)
  }, [])

  const handleProductKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showProductDropdown) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedProductIndex(prev => prev < filteredProductOptions.length - 1 ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedProductIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredProductOptions[selectedProductIndex]) {
          handleProductSelect(filteredProductOptions[selectedProductIndex])
        }
        break
      case 'Escape':
        setShowProductDropdown(false)
        break
    }
  }, [showProductDropdown, filteredProductOptions, selectedProductIndex, handleProductSelect])

  // 검색 실행 (365일 제한)
  const [searchError, setSearchError] = useState('')
  const handleSearch = useCallback(() => {
    const dateError = validateDateRange(startDate, endDate)
    if (dateError) {
      setSearchError(dateError)
      return
    }
    setSearchError('')
    setAppliedProduct(productSearch)
    setAppliedCustomer(customerSearch)
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
    setAppliedBranch(selectedBranch)
  }, [productSearch, customerSearch, startDate, endDate, selectedBranch])

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
      const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0)

      result.push({
        reference_number: ref,
        sale_date: firstItem.sale_date,
        branch_id: firstItem.branch_id,
        client_id: firstItem.client_id,
        customer_name: firstItem.customer_name,
        items: items,
        total_price: totalAmount,
        total_items: items.length,
        first_product_name: firstItem.product_name
      })
    })

    return result.sort((a, b) =>
      new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    )
  }, [data])

  // 검색 + 날짜 필터링 (적용된 필터 기준)
  const filteredGroups = useMemo(() => {
    return groupedData.filter((group) => {
      // 지점 필터
      if (appliedBranch && group.branch_id !== appliedBranch) return false

      // 날짜 필터
      if (appliedStartDate || appliedEndDate) {
        const groupDate = new Date(group.sale_date).toLocaleDateString('sv-SE')
        if (appliedStartDate && groupDate < appliedStartDate) return false
        if (appliedEndDate && groupDate > appliedEndDate) return false
      }

      // 품목코드/품목명 필터
      if (appliedProduct) {
        const ps = appliedProduct.toLowerCase()
        const matchesProduct = group.items.some(item =>
          (item.product_code || '').toLowerCase().includes(ps) ||
          (item.product_name || '').toLowerCase().includes(ps)
        )
        if (!matchesProduct) return false
      }

      // 거래처/비고 필터
      if (appliedCustomer) {
        const cs = appliedCustomer.toLowerCase()
        const matchesCustomer = (group.customer_name || '').toLowerCase().includes(cs)
        const matchesNotes = group.items.some(item =>
          (item.notes || '').toLowerCase().includes(cs)
        )
        if (!matchesCustomer && !matchesNotes) return false
      }

      return true
    })
  }, [groupedData, appliedProduct, appliedCustomer, appliedStartDate, appliedEndDate, appliedBranch])

  // 품목 기준: 개별 항목 필터링 (적용된 필터 기준)
  const filteredItems = useMemo(() => {
    return data.filter((item) => {
      // 지점 필터
      if (appliedBranch && item.branch_id !== appliedBranch) return false

      // 날짜 필터
      if (appliedStartDate || appliedEndDate) {
        const itemDate = new Date(item.sale_date).toLocaleDateString('sv-SE')
        if (appliedStartDate && itemDate < appliedStartDate) return false
        if (appliedEndDate && itemDate > appliedEndDate) return false
      }

      // 품목코드/품목명 필터
      if (appliedProduct) {
        const ps = appliedProduct.toLowerCase()
        if (
          !(item.product_code || '').toLowerCase().includes(ps) &&
          !(item.product_name || '').toLowerCase().includes(ps)
        ) return false
      }

      // 거래처/비고 필터
      if (appliedCustomer) {
        const cs = appliedCustomer.toLowerCase()
        if (
          !(item.customer_name || '').toLowerCase().includes(cs) &&
          !(item.notes || '').toLowerCase().includes(cs)
        ) return false
      }

      return true
    })
  }, [data, appliedProduct, appliedCustomer, appliedStartDate, appliedEndDate, appliedBranch])

  // 총 금액
  const totalAmount = viewMode === 'transaction'
    ? filteredGroups.reduce((sum, g) => sum + g.total_price, 0)
    : filteredItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
  const totalItems = viewMode === 'transaction'
    ? filteredGroups.reduce((sum, g) => sum + g.total_items, 0)
    : filteredItems.length
  const totalCount = viewMode === 'transaction' ? filteredGroups.length : filteredItems.length

  // 품목 기준 컬럼
  const itemColumns = [
    itemColumnHelper.accessor('sale_date', {
      header: '일자',
      size: 120,
      cell: (info) => (
        <span className="text-sm text-gray-900">{new Date(info.getValue()).toLocaleDateString('ko-KR')}</span>
      ),
    }),
    itemColumnHelper.accessor('product_code', {
      header: '품목코드',
      size: 110,
      cell: (info) => (
        <span className="text-sm font-mono text-blue-600">{info.getValue()}</span>
      ),
    }),
    itemColumnHelper.accessor('product_name', {
      header: '품목명',
      size: 180,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue()}</span>
      ),
    }),
    itemColumnHelper.accessor('quantity', {
      header: '수량',
      size: 80,
      cell: (info) => (
        <span className="text-sm font-semibold text-gray-900">{info.getValue().toLocaleString()}</span>
      ),
    }),
    itemColumnHelper.accessor('unit_price', {
      header: '단가',
      size: 110,
      cell: (info) => (
        <span className="text-sm text-gray-900">₩{info.getValue().toLocaleString()}</span>
      ),
    }),
    itemColumnHelper.accessor('supply_price', {
      header: '공급가',
      size: 110,
      cell: (info) => (
        <span className="text-sm text-gray-900">₩{info.getValue().toLocaleString()}</span>
      ),
    }),
    itemColumnHelper.accessor('tax_amount', {
      header: '부가세',
      size: 100,
      cell: (info) => (
        <span className="text-sm text-orange-600">₩{info.getValue().toLocaleString()}</span>
      ),
    }),
    itemColumnHelper.accessor('total_price', {
      header: '금액',
      size: 120,
      cell: (info) => (
        <span className="text-sm font-semibold text-blue-600">₩{info.getValue().toLocaleString()}</span>
      ),
    }),
    itemColumnHelper.accessor('customer_name', {
      header: '거래처',
      size: 140,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    itemColumnHelper.accessor('notes', {
      header: '비고',
      size: 140,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    itemColumnHelper.accessor('reference_number', {
      header: '거래번호',
      size: 140,
      cell: (info) => {
        const val = info.getValue()
        const item = info.row.original
        const handleClick = () => {
          const group = groupedData.find(g => g.reference_number === val)
          if (group) setSelectedGroup(group)
        }
        return (
          <span
            className="font-medium text-blue-600 cursor-pointer hover:underline truncate block"
            style={{ fontSize: '13px' }}
            onClick={handleClick}
          >
            {!val || val.startsWith('NO_REF_') ? '(없음)' : val}
          </span>
        )
      },
    }),
  ]

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
    columnHelper.accessor('total_price', {
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
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '상세',
      size: 120,
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
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    initialState: {
      pagination: { pageSize: 30 },
    },
  })

  const itemTable = useReactTable({
    data: filteredItems,
    columns: itemColumns,
    state: { sorting: itemSorting },
    onSortingChange: setItemSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    initialState: {
      pagination: { pageSize: 30 },
    },
  })

  // 페이지네이션용 공통 값
  const activePageCount = viewMode === 'transaction' ? table.getPageCount() : itemTable.getPageCount()
  const activePageIndex = viewMode === 'transaction'
    ? table.getState().pagination.pageIndex
    : itemTable.getState().pagination.pageIndex
  const activePageSize = viewMode === 'transaction'
    ? table.getState().pagination.pageSize
    : itemTable.getState().pagination.pageSize
  const canPrevPage = viewMode === 'transaction' ? table.getCanPreviousPage() : itemTable.getCanPreviousPage()
  const canNextPage = viewMode === 'transaction' ? table.getCanNextPage() : itemTable.getCanNextPage()
  const goToPage = (page: number) => viewMode === 'transaction' ? table.setPageIndex(page) : itemTable.setPageIndex(page)
  const goPrevPage = () => viewMode === 'transaction' ? table.previousPage() : itemTable.previousPage()
  const goNextPage = () => viewMode === 'transaction' ? table.nextPage() : itemTable.nextPage()
  const goLastPage = () => {
    const last = viewMode === 'transaction' ? table.getPageCount() - 1 : itemTable.getPageCount() - 1
    viewMode === 'transaction' ? table.setPageIndex(last) : itemTable.setPageIndex(last)
  }

  return (
    <div className="flex flex-col h-full">
      <ContentCard className="flex flex-col h-full !p-0">
        {/* 헤더 + 필터 */}
        <div className="p-3 sm:p-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {label} 내역
              {branchName && (
                <span className="ml-2 text-sm text-gray-900">({branchName})</span>
              )}
            </h2>
            <div className="text-sm text-gray-900">
              총 <span className="font-semibold text-blue-600">{totalCount}</span>건
              {viewMode === 'transaction' && (
                <> (<span className="font-semibold text-green-600">{totalItems}</span>품목)</>
              )} |
              합계 <span className="font-semibold text-red-600">₩{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* 조회 기준 토글 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-900">조회 기준:</span>
            <button
              onClick={() => setViewMode('transaction')}
              className={`px-4 py-1.5 text-sm rounded-lg border transition font-medium ${
                viewMode === 'transaction'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              거래건
            </button>
            <button
              onClick={() => setViewMode('product')}
              className={`px-4 py-1.5 text-sm rounded-lg border transition font-medium ${
                viewMode === 'product'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
              }`}
            >
              품목별
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 지점 선택 (관리자만) */}
            {userRole === '0000' && branchOptions.length > 0 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-36 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">전체 지점</option>
                {branchOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {/* 품목코드/품목명 자동완성 */}
            <div className="relative flex-1 min-w-[220px]">
              <input
                ref={productInputRef}
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={handleProductKeyDown}
                onFocus={() => { if (filteredProductOptions.length > 0 && productSearch.length >= 1) setShowProductDropdown(true) }}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                placeholder="품목코드 또는 품목명"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {showProductDropdown && (
                <div
                  ref={productDropdownRef}
                  className="absolute left-0 top-full mt-1 w-full min-w-[360px] max-h-72 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-50"
                >
                  {filteredProductOptions.map((product, index) => (
                    <div
                      key={product.id}
                      onMouseDown={() => handleProductSelect(product)}
                      className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
                        index === selectedProductIndex ? 'bg-blue-100' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm text-blue-600">{product.code}</span>
                          <span className="text-sm text-gray-900 ml-2">{product.name}</span>
                        </div>
                        <span className="text-xs text-gray-800">{product.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 거래처/비고 검색 */}
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="거래처 또는 비고"
              className="flex-1 min-w-[180px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-900 font-medium whitespace-nowrap">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-900 font-medium whitespace-nowrap">종료일</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => {
                const today = new Date().toLocaleDateString('sv-SE')
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
                setStartDate(firstDay.toLocaleDateString('sv-SE'))
                setEndDate(today.toLocaleDateString('sv-SE'))
              }}
              className="px-4 py-2.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition whitespace-nowrap font-medium"
            >
              이번달
            </button>
            <button
              onClick={handleSearch}
              className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap font-medium"
            >
              검색
            </button>
          </div>
          {searchError && (
            <p className="text-sm text-red-600 mt-2">{searchError}</p>
          )}
        </div>

        {/* 페이지네이션 */}
        {activePageCount > 1 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0">
            <div className="flex items-center gap-1">
              <button onClick={() => goToPage(0)} disabled={!canPrevPage} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">«</button>
              <button onClick={goPrevPage} disabled={!canPrevPage} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">‹</button>
              {generatePageNumbers(activePageIndex, activePageCount).map((page, i) =>
                page === -1 ? (
                  <span key={`e-${i}`} className="px-2 text-sm text-gray-800">…</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition ${
                      activePageIndex === page
                        ? 'bg-blue-600 text-white font-medium'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page + 1}
                  </button>
                )
              )}
              <button onClick={goNextPage} disabled={!canNextPage} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">›</button>
              <button onClick={goLastPage} disabled={!canNextPage} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">»</button>
            </div>
            <span className="text-sm text-gray-900">
              총 {totalCount}건 중 {activePageIndex * activePageSize + 1}-
              {Math.min((activePageIndex + 1) * activePageSize, totalCount)}건 표시
            </span>
          </div>
        )}

        {/* 모바일 카드뷰 */}
        <div className="md:hidden flex-1 overflow-y-auto">
          {viewMode === 'transaction' ? (
            // 거래건 기준 모바일
            table.getRowModel().rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-900">
                {(productSearch || customerSearch) ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
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
                        <p className="text-xs text-gray-900 mt-1">
                          {new Date(group.sale_date).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-900">거래처</p>
                        <p className="font-medium text-gray-900">{group.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-900">품목</p>
                        <p className="font-medium text-gray-900">
                          {group.first_product_name}
                          {group.total_items > 1 && <span className="text-blue-600"> 외 {group.total_items - 1}개</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-900">품목 수</p>
                        <p className="font-medium text-gray-900">{group.total_items}개</p>
                      </div>
                      <div>
                        <p className="text-gray-900">총액</p>
                        <p className="font-bold text-blue-700">₩{group.total_price.toLocaleString()}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedGroup(group)} className="w-full">
                      상세보기
                    </Button>
                  </div>
                )
              })
            )
          ) : (
            // 품목별 기준 모바일
            itemTable.getRowModel().rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-900">
                {(productSearch || customerSearch) ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
              </div>
            ) : (
              itemTable.getRowModel().rows.map((row) => {
                const item = row.original
                return (
                  <div key={row.id} className="p-3 border-b hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-mono text-blue-600">{item.product_code}</span>
                        <span className="text-sm text-gray-900 ml-2">{item.product_name}</span>
                      </div>
                      <span className="text-xs text-gray-900">{new Date(item.sale_date).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-900">수량</p>
                        <p className="font-semibold text-gray-900">{item.quantity.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-900">금액</p>
                        <p className="font-bold text-blue-700">₩{item.total_price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-900">거래처</p>
                        <p className="font-medium text-gray-900">{item.customer_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-900">비고</p>
                        <p className="text-gray-900">{item.notes || '-'}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )
          )}
        </div>

        {/* 데스크톱 테이블 - 거래건 기준 */}
        {viewMode === 'transaction' && (
          <div className="hidden md:block flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <table style={{ width: table.getCenterTotalSize() }} className="min-w-[860px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort()
                        const sorted = header.column.getIsSorted()
                        return (
                          <th
                            key={header.id}
                            style={{ width: header.getSize(), position: 'relative' }}
                            className="px-4 py-3 text-xs font-medium text-gray-900 uppercase tracking-wider text-center"
                          >
                            <span
                              className={`inline-flex items-center justify-center gap-1 ${canSort ? 'cursor-pointer select-none' : ''}`}
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort && (
                                <span className="text-gray-800">
                                  {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ' ↕'}
                                </span>
                              )}
                            </span>
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-400 ${header.column.getIsResizing() ? 'bg-blue-500' : ''}`}
                            />
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-900">
                        {(productSearch || customerSearch) ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-4 py-3 text-center">
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
        )}

        {/* 데스크톱 테이블 - 품목별 기준 */}
        {viewMode === 'product' && (
          <div className="hidden md:block flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px]" style={{ width: itemTable.getCenterTotalSize() }}>
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  {itemTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort()
                        const sorted = header.column.getIsSorted()
                        return (
                          <th
                            key={header.id}
                            style={{ width: header.getSize() }}
                            className="px-4 py-3 text-xs font-medium text-gray-900 uppercase tracking-wider text-center relative"
                          >
                            <span
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                              className={`inline-flex items-center justify-center gap-1 ${
                                canSort ? 'cursor-pointer select-none hover:text-gray-900 transition' : ''
                              }`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort && (
                                <span className="text-gray-800">
                                  {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ' ↕'}
                                </span>
                              )}
                            </span>
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-400 ${
                                header.column.getIsResizing() ? 'bg-blue-500' : ''
                              }`}
                            />
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={itemColumns.length} className="px-4 py-8 text-center text-gray-900">
                        {(productSearch || customerSearch) ? '검색 결과가 없습니다.' : `${label} 내역이 없습니다.`}
                      </td>
                    </tr>
                  ) : (
                    itemTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-4 py-3 text-center">
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
        )}
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
