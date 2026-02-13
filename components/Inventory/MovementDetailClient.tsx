'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { ContentCard } from '@/components/ui/Card'
import { getMovementHistory } from '@/app/inventory/movements/actions'
import type { InventoryMovement } from '@/types/inventory'
import type { Product, UserData } from '@/types'

interface Branch {
  id: string
  name: string
  code: string
}

interface Props {
  userSession: UserData
  products: Product[]
  branches: Branch[]
}

export default function MovementDetailClient({ userSession, products, branches }: Props) {
  const isAdmin = userSession.role === '0000'

  // 기간 필터
  const today = new Date().toLocaleDateString('sv-SE')
  const defaultStart = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toLocaleDateString('sv-SE')
  })()
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)

  // 지점 선택 (관리자만)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isAdmin ? '' : (userSession.branch_id || '')
  )

  // 품목 자동완성
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  // 데이터 상태
  const [data, setData] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // AG Grid ref
  const gridRef = useRef<any>(null)

  // 품목 검색 필터링
  const filteredProducts = useMemo(() => {
    if (productSearch.length < 1 || selectedProduct) return []
    const search = productSearch.toLowerCase()
    return products
      .filter(p => p.code.toLowerCase().includes(search) || p.name.toLowerCase().includes(search))
      .slice(0, 10)
  }, [productSearch, products, selectedProduct])

  useEffect(() => {
    setShowDropdown(filteredProducts.length > 0 && productSearch.length >= 1 && !selectedProduct)
    setSelectedIndex(0)
  }, [filteredProducts, productSearch, selectedProduct])

  // 선택 항목 스크롤
  useEffect(() => {
    if (showDropdown && dropdownListRef.current) {
      const el = dropdownListRef.current.children[selectedIndex] as HTMLElement
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, showDropdown])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 품목 선택
  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product)
    setProductSearch(`${product.code} - ${product.name}`)
    setShowDropdown(false)
  }, [])

  // 품목 선택 해제
  const handleProductClear = useCallback(() => {
    setSelectedProduct(null)
    setProductSearch('')
    setData([])
    setSearched(false)
  }, [])

  // 키보드 네비게이션
  const handleProductKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredProducts[selectedIndex]) {
          handleProductSelect(filteredProducts[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }, [showDropdown, filteredProducts, selectedIndex, handleProductSelect])

  // 조회 실행
  const handleSearch = async () => {
    if (!selectedProduct) {
      alert('품목을 선택하세요.')
      return
    }
    setLoading(true)
    setSearched(true)

    const result = await getMovementHistory({
      branchId: selectedBranchId || null,
      productId: selectedProduct.id,
      startDate,
      endDate,
    })

    if (result.success) {
      setData(result.data)
    } else {
      setData([])
      alert(result.message || '조회 실패')
    }
    setLoading(false)
  }

  // 월별 소계가 포함된 행 데이터 생성
  const rowDataWithSubtotals = useMemo(() => {
    if (data.length === 0) return []

    const rows: (InventoryMovement & { _isSubtotal?: boolean; _monthLabel?: string })[] = []
    let currentMonth = ''
    let monthIn = 0
    let monthOut = 0
    let monthEndBalance = 0

    data.forEach((m) => {
      // 전일재고 행은 그대로 추가 (월별 소계 계산에서 제외)
      if (m.movement_type === '전일재고') {
        rows.push(m)
        return
      }

      const date = new Date(m.movement_date)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      // 월이 바뀌면 이전 월 소계 추가
      if (currentMonth && month !== currentMonth) {
        const [y, mo] = currentMonth.split('-')
        rows.push({
          movement_date: '',
          movement_type: '_subtotal',
          party_name: '',
          remarks: `${y}년 ${Number(mo)}월 소계`,
          incoming_qty: monthIn,
          outgoing_qty: monthOut,
          running_balance: monthEndBalance,
          _isSubtotal: true,
          _monthLabel: `${y}년 ${Number(mo)}월 소계`,
        } as any)
        monthIn = 0
        monthOut = 0
      }

      currentMonth = month
      monthIn += Number(m.incoming_qty)
      monthOut += Number(m.outgoing_qty)
      monthEndBalance = Number(m.running_balance)

      rows.push(m)
    })

    // 마지막 월 소계 추가
    if (currentMonth) {
      const [y, mo] = currentMonth.split('-')
      rows.push({
        movement_date: '',
        movement_type: '_subtotal',
        party_name: '',
        remarks: `${y}년 ${Number(mo)}월 소계`,
        incoming_qty: monthIn,
        outgoing_qty: monthOut,
        running_balance: monthEndBalance,
        _isSubtotal: true,
        _monthLabel: `${y}년 ${Number(mo)}월 소계`,
      } as any)
    }

    return rows
  }, [data])

  // 합계 계산 (전일재고/소계 행 제외)
  const totals = useMemo(() => {
    const movements = data.filter(m => m.movement_type !== '전일재고')
    return {
      totalIn: movements.reduce((sum, m) => sum + Number(m.incoming_qty), 0),
      totalOut: movements.reduce((sum, m) => sum + Number(m.outgoing_qty), 0),
      lastBalance: data.length > 0 ? Number(data[data.length - 1].running_balance) : 0,
    }
  }, [data])

  // 지점명
  const branchName = useMemo(() => {
    if (!selectedBranchId) return '전체 지점'
    const branch = branches.find(b => b.id === selectedBranchId)
    return branch?.name || userSession.branch_name || ''
  }, [selectedBranchId, branches, userSession.branch_name])

  // AG Grid 컬럼 정의
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '일자',
      field: 'movement_date',
      width: 120,
      minWidth: 110,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return ''
        if (params.data?.movement_type === '전일재고' || params.data?.movement_type === '_subtotal') return ''
        return new Date(params.value).toLocaleDateString('ko-KR')
      },
      cellClass: 'text-center text-sm',
    },
    {
      headerName: '거래처명',
      field: 'party_name',
      width: 160,
      minWidth: 120,
      cellClass: 'text-center text-sm',
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.data?.movement_type === '전일재고' || params.data?.movement_type === '_subtotal') return ''
        return params.value || '-'
      },
    },
    {
      headerName: '적요',
      field: 'remarks',
      width: 200,
      minWidth: 160,
      sortable: false,
      cellClass: (params: any) => {
        if (params.data?.movement_type === '전일재고') return 'text-center text-sm font-bold text-blue-700'
        if (params.data?.movement_type === '_subtotal') return 'text-center text-sm font-bold text-amber-800'
        return 'text-center text-sm text-gray-600'
      },
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.data?.movement_type === '전일재고') return '전일재고'
        if (params.data?.movement_type === '_subtotal') return params.value || ''
        return params.value || '-'
      },
    },
    {
      headerName: '입고수량',
      field: 'incoming_qty',
      width: 110,
      minWidth: 100,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: (params: any) => {
        if (params.data?.movement_type === '전일재고') return 'text-right text-sm'
        if (params.data?.movement_type === '_subtotal') return 'text-right text-sm font-bold text-amber-800'
        return Number(params.value) > 0 ? 'text-right text-sm font-semibold text-blue-600' : 'text-right text-sm text-gray-300'
      },
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.data?.movement_type === '전일재고') return ''
        if (params.data?.movement_type === '_subtotal') {
          const val = Number(params.value) || 0
          return val > 0 ? val.toLocaleString() : '-'
        }
        const val = Number(params.value) || 0
        return val > 0 ? val.toLocaleString() : '-'
      },
    },
    {
      headerName: '출고수량',
      field: 'outgoing_qty',
      width: 110,
      minWidth: 100,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: (params: any) => {
        if (params.data?.movement_type === '전일재고') return 'text-right text-sm'
        if (params.data?.movement_type === '_subtotal') return 'text-right text-sm font-bold text-amber-800'
        return Number(params.value) > 0 ? 'text-right text-sm font-semibold text-red-600' : 'text-right text-sm text-gray-300'
      },
      valueFormatter: (params: ValueFormatterParams) => {
        if (params.data?.movement_type === '전일재고') return ''
        if (params.data?.movement_type === '_subtotal') {
          const val = Number(params.value) || 0
          return val > 0 ? val.toLocaleString() : '-'
        }
        const val = Number(params.value) || 0
        return val > 0 ? val.toLocaleString() : '-'
      },
    },
    {
      headerName: '재고수량',
      field: 'running_balance',
      width: 110,
      minWidth: 100,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: (params: any) => {
        if (params.data?.movement_type === '_subtotal') return 'text-right text-sm font-bold text-amber-800'
        return 'text-right text-sm font-bold text-gray-900'
      },
      valueFormatter: (params: ValueFormatterParams) => {
        const val = Number(params.value) || 0
        return val.toLocaleString()
      },
    },
  ], [])

  // 합계 행 (pinnedBottom)
  const pinnedBottomRowData = useMemo(() => {
    if (data.length === 0) return []
    return [{
      movement_date: '',
      movement_type: '_total',
      party_name: '',
      remarks: '합계',
      incoming_qty: totals.totalIn,
      outgoing_qty: totals.totalOut,
      running_balance: totals.lastBalance,
    }]
  }, [data.length, totals])

  // 전일재고/소계/합계 행 스타일
  const getRowStyle = useCallback((params: any): { [key: string]: string } | undefined => {
    if (params.data?.movement_type === '전일재고') {
      return { backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe' }
    }
    if (params.data?.movement_type === '_subtotal') {
      return { backgroundColor: '#fffbeb', borderTop: '1px solid #fcd34d', borderBottom: '1px solid #fcd34d' }
    }
    if (params.node.rowPinned === 'bottom') {
      return { fontWeight: 'bold', backgroundColor: '#f9fafb', borderTop: '2px solid #d1d5db' }
    }
    return undefined
  }, [])

  return (
    <>
      {/* 헤더 */}
      <ContentCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">재고수불부</h1>
            {selectedProduct && searched && (
              <p className="text-sm text-gray-600 mt-1">
                품목: {selectedProduct.name} [{selectedProduct.unit}] ({selectedProduct.code})
                <span className="ml-3 text-gray-400">
                  {startDate} ~ {endDate}
                </span>
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm text-gray-600">{branchName}</div>
            {data.length > 0 && (
              <div className="text-sm mt-1">
                입고 <span className="font-semibold text-blue-600">{totals.totalIn.toLocaleString()}</span> |
                출고 <span className="font-semibold text-red-600">{totals.totalOut.toLocaleString()}</span> |
                재고 <span className="font-bold text-gray-900">{totals.lastBalance.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </ContentCard>

      {/* 필터 영역 - 일렬 배치: 지점 | 시작일 | 종료일 | 품목 | 조회 */}
      <ContentCard>
        <div className="flex flex-wrap items-end gap-4">
          {/* 지점 선택 (관리자만) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지점</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체 지점</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 시작일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 품목 선택 */}
          <div className="flex-1 min-w-[250px]" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              품목 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    if (selectedProduct) setSelectedProduct(null)
                  }}
                  onKeyDown={handleProductKeyDown}
                  onFocus={() => {
                    if (productSearch && !selectedProduct) setShowDropdown(true)
                  }}
                  placeholder="품목코드 또는 품명 입력..."
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    selectedProduct ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                  }`}
                />
                {selectedProduct && (
                  <button
                    onClick={handleProductClear}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    X
                  </button>
                )}
              </div>
              {showDropdown && filteredProducts.length > 0 && (
                <div ref={dropdownListRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredProducts.map((product, index) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className={`w-full px-4 py-2 text-left border-b border-gray-100 last:border-b-0 ${
                        index === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 text-sm">{product.code}</span>
                        <span className="text-sm text-gray-900">{product.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {product.category_name || '미분류'} | {product.unit}
                        {product.specification ? ` | ${product.specification}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            disabled={loading || !selectedProduct}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </ContentCard>

      {/* 결과 영역 */}
      <ContentCard className="!p-0">
        {/* 모바일 카드뷰 */}
        <div className="md:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p>데이터 로딩 중...</p>
            </div>
          ) : !searched ? (
            <div className="px-4 py-8 text-center text-gray-500">
              품목을 선택하고 조회 버튼을 눌러주세요.
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              조회 결과가 없습니다.
            </div>
          ) : (
            <>
              {rowDataWithSubtotals.map((item, idx) => {
                const isCarryForward = item.movement_type === '전일재고'
                const isSubtotal = item.movement_type === '_subtotal'
                return (
                  <div
                    key={idx}
                    className={`p-3 border-b ${isCarryForward ? 'bg-blue-50' : isSubtotal ? 'bg-amber-50 border-amber-300' : 'hover:bg-gray-50'} transition`}
                  >
                    {isCarryForward ? (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-700">전일재고</span>
                        <span className="text-sm font-bold text-gray-900">
                          {Number(item.running_balance).toLocaleString()}
                        </span>
                      </div>
                    ) : isSubtotal ? (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-amber-800">{item.remarks}</span>
                        <div className="flex gap-3 text-sm">
                          {Number(item.incoming_qty) > 0 && (
                            <span className="font-bold text-amber-800">입고 {Number(item.incoming_qty).toLocaleString()}</span>
                          )}
                          {Number(item.outgoing_qty) > 0 && (
                            <span className="font-bold text-amber-800">출고 {Number(item.outgoing_qty).toLocaleString()}</span>
                          )}
                          <span className="font-bold text-amber-800">재고 {Number(item.running_balance).toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-500">
                            {new Date(item.movement_date).toLocaleDateString('ko-KR')}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            잔량: {Number(item.running_balance).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">거래처</p>
                            <p className="font-medium text-gray-900">{item.party_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">적요</p>
                            <p className="font-medium text-gray-900">{item.remarks || '-'}</p>
                          </div>
                          {Number(item.incoming_qty) > 0 && (
                            <div>
                              <p className="text-gray-600">입고</p>
                              <p className="font-semibold text-blue-600">
                                {Number(item.incoming_qty).toLocaleString()}
                              </p>
                            </div>
                          )}
                          {Number(item.outgoing_qty) > 0 && (
                            <div>
                              <p className="text-gray-600">출고</p>
                              <p className="font-semibold text-red-600">
                                {Number(item.outgoing_qty).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
              {/* 모바일 합계 */}
              <div className="p-3 bg-gray-50 border-t-2 border-gray-300">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-900">합계</span>
                  <div className="flex gap-4">
                    <span>입고 <span className="font-bold text-blue-600">{totals.totalIn.toLocaleString()}</span></span>
                    <span>출고 <span className="font-bold text-red-600">{totals.totalOut.toLocaleString()}</span></span>
                    <span>재고 <span className="font-bold text-gray-900">{totals.lastBalance.toLocaleString()}</span></span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 데스크톱 AG Grid */}
        <div className="hidden md:block">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p>데이터 로딩 중...</p>
            </div>
          ) : !searched ? (
            <div className="px-4 py-8 text-center text-gray-500">
              품목을 선택하고 조회 버튼을 눌러주세요.
            </div>
          ) : rowDataWithSubtotals.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              조회 결과가 없습니다.
            </div>
          ) : (
            <div className="ag-theme-alpine" style={{ width: '100%' }}>
              <AgGridReact
                ref={gridRef}
                rowData={rowDataWithSubtotals}
                columnDefs={columnDefs}
                defaultColDef={{
                  sortable: true,
                  resizable: true,
                  headerClass: 'ag-header-cell-center',
                }}
                domLayout="autoHeight"
                pinnedBottomRowData={pinnedBottomRowData}
                getRowStyle={getRowStyle}
                rowHeight={42}
                headerHeight={45}
                suppressMovableColumns={true}
                suppressCellFocus={true}
                animateRows={true}
                overlayNoRowsTemplate="<span class='text-gray-500'>조회 결과가 없습니다.</span>"
              />
            </div>
          )}
        </div>
      </ContentCard>
    </>
  )
}
