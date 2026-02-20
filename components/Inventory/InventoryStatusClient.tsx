'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { InventoryLayerModal } from './InventoryLayerModal'
import { ContentCard } from '@/components/ui/Card'
import { getInventoryStatus } from '@/app/inventory/actions'
import {
  calculateStockStatus,
  STOCK_STATUS_COLORS,
  STOCK_STATUS_ICONS
} from '@/types/inventory'
import type { InventoryStatusItem } from '@/types/inventory'
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

export default function InventoryStatusClient({ userSession, products, branches }: Props) {
  // 지점 필터 (관리자 전용)
  const [selectedBranch, setSelectedBranch] = useState('')

  // 기간 필터 상태
  const today = new Date().toLocaleDateString('sv-SE')
  const defaultStart = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toLocaleDateString('sv-SE')
  })()
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)

  // 품목 복수 선택 상태
  const [productSearch, setProductSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  // 데이터 상태
  const [data, setData] = useState<InventoryStatusItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // 모달
  const [selectedItem, setSelectedItem] = useState<any>(null)

  // 이미 선택된 품목 ID Set
  const selectedProductIds = useMemo(
    () => new Set(selectedProducts.map(p => p.id)),
    [selectedProducts]
  )

  // 품목 검색 필터링 (이미 선택된 품목 제외)
  const filteredProducts = useMemo(() => {
    if (productSearch.length < 1) return []
    const search = productSearch.toLowerCase()
    return products
      .filter(p =>
        !selectedProductIds.has(p.id) &&
        (p.code.toLowerCase().includes(search) || p.name.toLowerCase().includes(search))
      )
      .slice(0, 10)
  }, [productSearch, products, selectedProductIds])

  useEffect(() => {
    setShowDropdown(filteredProducts.length > 0 && productSearch.length >= 1)
    setSelectedIndex(0)
    setNavigating(false)
  }, [filteredProducts, productSearch])

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

  // 품목 선택 핸들러 (추가)
  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProducts(prev => [...prev, product])
    setProductSearch('')
    setShowDropdown(false)
    productInputRef.current?.focus()
  }, [])

  // 품목 개별 제거
  const handleProductRemove = useCallback((productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId))
  }, [])

  // 품목 전체 초기화
  const handleProductClearAll = useCallback(() => {
    setSelectedProducts([])
    setProductSearch('')
  }, [])

  // 조회 실행
  const handleSearch = useCallback(async () => {
    setLoading(true)
    setSearched(true)

    // 선택된 품목 ID + 검색어 텍스트 매칭 품목 ID 합산
    let productIds: string[] | null = null
    const selectedIds = selectedProducts.map(p => p.id)

    if (productSearch.trim().length > 0) {
      const search = productSearch.trim().toLowerCase()
      const matchedIds = products
        .filter(p =>
          p.code.toLowerCase().includes(search) || p.name.toLowerCase().includes(search)
        )
        .map(p => p.id)
      const merged = new Set([...selectedIds, ...matchedIds])
      productIds = merged.size > 0 ? Array.from(merged) : null
    } else if (selectedIds.length > 0) {
      productIds = selectedIds
    }

    const result = await getInventoryStatus({
      branchId: selectedBranch || null,
      productIds,
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
  }, [selectedProducts, productSearch, products, selectedBranch, startDate, endDate])

  // 키보드 네비게이션
  const [navigating, setNavigating] = useState(false)

  const handleProductKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Backspace로 마지막 태그 삭제
    if (e.key === 'Backspace' && productSearch === '' && selectedProducts.length > 0) {
      setSelectedProducts(prev => prev.slice(0, -1))
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        if (!showDropdown) return
        e.preventDefault()
        if (!navigating) {
          setNavigating(true)
          setSelectedIndex(0)
        } else {
          setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : prev)
        }
        break
      case 'ArrowUp':
        if (!showDropdown) return
        e.preventDefault()
        setNavigating(true)
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (navigating && showDropdown && filteredProducts[selectedIndex]) {
          // 화살표로 드롭다운 탐색 중 → 해당 품목 선택
          handleProductSelect(filteredProducts[selectedIndex])
          setNavigating(false)
        } else {
          // 검색어 입력 후 바로 Enter → 조회 실행
          setShowDropdown(false)
          handleSearch()
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setNavigating(false)
        break
    }
  }, [showDropdown, filteredProducts, selectedIndex, handleProductSelect, handleSearch, navigating, productSearch, selectedProducts.length])

  // 지점 목록 (서버에서 전달받은 데이터 사용)
  const branchOptions = useMemo(() =>
    branches.map(b => [b.id, b.name] as [string, string]),
    [branches]
  )

  // 초기 로딩
  useEffect(() => {
    handleSearch()
  }, [])

  // 합계 계산
  const totals = useMemo(() => ({
    totalQuantity: data.reduce((sum, r) => sum + r.current_quantity, 0),
    totalValue: data.reduce((sum, r) => sum + r.inventory_value, 0),
    stockProductCount: data.filter(r => r.current_quantity > 0).length,
  }), [data])

  return (
    <>
      {/* 헤더 */}
      <ContentCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">재고 현황</h1>
            <p className="text-sm text-gray-900 mt-1">
              {startDate} ~ {endDate} 기간 재고 현황
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm text-gray-900">
              {userSession.is_headquarters && ['0000', '0001'].includes(userSession.role)
                ? (selectedBranch
                  ? branchOptions.find(([id]) => id === selectedBranch)?.[1] || '전체 지점'
                  : '전체 지점')
                : userSession.branch_name}
            </div>
          </div>
        </div>
      </ContentCard>

      {/* 요약 카드 */}
      {searched && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ContentCard>
            <div className="text-center">
              <p className="text-sm text-gray-900 mb-1">재고보유 품목수</p>
              <p className="text-2xl font-bold text-gray-900">
                {totals.stockProductCount.toLocaleString()}
                <span className="text-sm font-normal text-gray-900 ml-1">건</span>
              </p>
            </div>
          </ContentCard>
          <ContentCard>
            <div className="text-center">
              <p className="text-sm text-gray-900 mb-1">총 재고 수량</p>
              <p className="text-2xl font-bold text-blue-600">
                {totals.totalQuantity.toLocaleString()}
              </p>
            </div>
          </ContentCard>
          <ContentCard>
            <div className="text-center">
              <p className="text-sm text-gray-900 mb-1">총 재고금액</p>
              <p className="text-2xl font-bold text-green-600">
                {`\u20A9${totals.totalValue.toLocaleString()}`}
              </p>
              <p className="text-xs text-gray-800 mt-0.5">부가세포함</p>
            </div>
          </ContentCard>
        </div>
      )}

      {/* 필터 영역 */}
      <ContentCard>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* 지점 선택 (본사 관리자/원장) */}
            {userSession.is_headquarters && ['0000', '0001'].includes(userSession.role) && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">지점</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">전체 지점</option>
                  {branchOptions.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">종료일(재고 기준일)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 품목 복수 선택 */}
            <div className="flex-1 min-w-[250px]" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                품목
                {selectedProducts.length > 0 && (
                  <span className="ml-1 text-blue-600">({selectedProducts.length}개 선택)</span>
                )}
              </label>
              <div className="relative">
                <div
                  className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white min-h-[42px] cursor-text"
                  onClick={() => productInputRef.current?.focus()}
                >
                  {selectedProducts.map(p => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-sm font-medium whitespace-nowrap"
                    >
                      <span className="font-mono text-xs">{p.code}</span>
                      <span className="text-blue-600">{p.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProductRemove(p.id) }}
                        className="ml-0.5 text-blue-400 hover:text-red-500 transition font-bold"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    ref={productInputRef}
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={handleProductKeyDown}
                    onFocus={() => {
                      if (productSearch.length >= 1) setShowDropdown(true)
                    }}
                    placeholder={selectedProducts.length === 0 ? '품목코드 또는 품명 입력...' : '추가 검색...'}
                    className="flex-1 min-w-[120px] px-1 py-1 outline-none text-sm bg-transparent"
                  />
                  {selectedProducts.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleProductClearAll() }}
                      className="px-1.5 py-0.5 text-gray-400 hover:text-red-500 transition text-sm font-bold"
                      title="전체 해제"
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
                          navigating && index === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 text-sm">{product.code}</span>
                          <span className="text-sm text-gray-900">{product.name}</span>
                        </div>
                        <div className="text-xs text-gray-900 mt-0.5">
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
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </ContentCard>

      {/* 결과 테이블 */}
      <ContentCard>
        {/* 테이블 */}
        <div className="-mx-4 sm:-mx-6">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider w-12 sticky top-16 z-10 bg-gray-50">No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">품목코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">품목명</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">단위</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">재고수량</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">입고단가</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">재고금액</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider sticky top-16 z-10 bg-gray-50">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-900">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p>데이터 로딩 중...</p>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-900">
                    {searched ? '조회 결과가 없습니다.' : '조회 버튼을 눌러 검색하세요.'}
                  </td>
                </tr>
              ) : (
                data.map((item, index) => {
                  const status = calculateStockStatus(item.current_quantity, item.min_stock_level || 0)
                  const colors = STOCK_STATUS_COLORS[status]

                  return (
                    <tr key={`${item.branch_id}-${item.product_id}`} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedItem({
                            branch_id: item.branch_id,
                            branch_name: item.branch_name,
                            product_id: item.product_id,
                            product_code: item.product_code,
                            product_name: item.product_name,
                            unit: item.unit,
                            category: item.category,
                            current_quantity: item.current_quantity,
                            layer_count: item.layer_count,
                            oldest_purchase_date: item.oldest_purchase_date,
                            newest_purchase_date: item.newest_purchase_date,
                            avg_unit_cost: item.weighted_avg_cost,
                            min_stock_level: item.min_stock_level,
                          })}
                          className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition"
                        >
                          {item.product_code}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        {item.category && <div className="text-xs text-gray-900">{item.category}</div>}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.current_quantity.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-900">
                          {`\u20A9${item.weighted_avg_cost.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {`\u20A9${item.inventory_value.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {STOCK_STATUS_ICONS[status]} {status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">합계</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {totals.totalQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">-</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-700">
                    {`\u20A9${totals.totalValue.toLocaleString()}`}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ContentCard>

      {/* 입출고 내역 모달 */}
      {selectedItem && (
        <InventoryLayerModal
          item={selectedItem}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setSelectedItem(null)}
          userSession={userSession}
          products={products}
        />
      )}
    </>
  )
}
