'use client'

// ============================================================
// Phase 6: Report Filters Component
// ============================================================
// 작성일: 2025-01-26
// 목적: 레포트 필터 UI 컴포넌트 (날짜, 그룹핑 방식 선택)
// 참고: 모든 레포트 페이지에서 공통으로 사용
// ============================================================

import { useState } from 'react'
import { ReportFilter, ReportGroupByOption } from '@/types/reports'
import { Button } from '@/components/ui/Button'

interface Props {
  /** 초기 필터 값 */
  initialFilter: ReportFilter
  /** 그룹핑 옵션 (레포트 종류별로 다름) */
  groupByOptions: ReportGroupByOption[]
  /** 필터 변경 시 호출 */
  onFilterChange: (filter: ReportFilter) => void
  /** 지점 필터 표시 여부 (시스템 관리자만 true) */
  showBranchFilter?: boolean
  /** 지점 목록 (선택사항) */
  branches?: { id: string; name: string }[]
  /** 카테고리 목록 (선택사항) */
  categories?: { id: string; name: string }[]
}

export default function ReportFilters({
  initialFilter,
  groupByOptions,
  onFilterChange,
  showBranchFilter = false,
  branches = [],
  categories = [],
}: Props) {
  const [startDate, setStartDate] = useState(initialFilter.startDate)
  const [endDate, setEndDate] = useState(initialFilter.endDate)
  const [groupBy, setGroupBy] = useState(initialFilter.groupBy)
  const [branchId, setBranchId] = useState<string | null>(initialFilter.branchId || null)
  const [categoryId, setCategoryId] = useState<string | null>(initialFilter.categoryId || null)

  /**
   * 조회 버튼 클릭 핸들러
   */
  const handleSearch = () => {
    onFilterChange({
      startDate,
      endDate,
      groupBy,
      branchId: showBranchFilter ? branchId : null,
      categoryId,
    })
  }

  /**
   * 빠른 날짜 선택 핸들러
   */
  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const handleQuickDateRange = (range: 'today' | 'week' | 'lastMonth' | 'thisMonth' | 'recent1month' | 'lastYear' | 'thisYear') => {
    const today = new Date()
    const todayStr = formatDate(today)
    const year = today.getFullYear()

    switch (range) {
      case 'today':
        setStartDate(todayStr)
        setEndDate(todayStr)
        break
      case 'week': {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        setStartDate(formatDate(weekAgo))
        setEndDate(todayStr)
        break
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(year, today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(year, today.getMonth(), 0)
        setStartDate(formatDate(lastMonthStart))
        setEndDate(formatDate(lastMonthEnd))
        break
      }
      case 'thisMonth': {
        const thisMonthStart = new Date(year, today.getMonth(), 1)
        const thisMonthEnd = new Date(year, today.getMonth() + 1, 0)
        setStartDate(formatDate(thisMonthStart))
        setEndDate(formatDate(thisMonthEnd))
        break
      }
      case 'recent1month': {
        const monthAgo = new Date(today)
        monthAgo.setDate(monthAgo.getDate() - 30)
        setStartDate(formatDate(monthAgo))
        setEndDate(todayStr)
        break
      }
      case 'lastYear': {
        setStartDate(`${year - 1}-01-01`)
        setEndDate(`${year - 1}-12-31`)
        break
      }
      case 'thisYear': {
        setStartDate(`${year}-01-01`)
        setEndDate(`${year}-12-31`)
        break
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* 날짜 필터 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-900 mb-1">
            시작일
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-900 mb-1">
            종료일
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 빠른 날짜 선택 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          {([
            ['today', '오늘'],
            ['week', '최근 7일'],
            ['lastMonth', '저번달'],
            ['thisMonth', '이번달'],
            ['recent1month', '최근 1개월'],
            ['lastYear', '작년'],
            ['thisYear', '올해'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickDateRange(key)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 그룹핑 방식 & 지점 필터 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="groupBy" className="block text-sm font-medium text-gray-900 mb-1">
            그룹핑 방식
          </label>
          <select
            id="groupBy"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {groupByOptions.map((option) => (
              <option key={option.value} value={option.value} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 지점 필터 (시스템 관리자만 표시) */}
        {showBranchFilter && branches.length > 0 && (
          <div>
            <label htmlFor="branchId" className="block text-sm font-medium text-gray-900 mb-1">
              지점
            </label>
            <select
              id="branchId"
              value={branchId || ''}
              onChange={(e) => setBranchId(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 지점</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 카테고리 필터 */}
        {categories.length > 0 && (
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-900 mb-1">
              카테고리
            </label>
            <select
              id="categoryId"
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 조회 버튼 */}
        <Button variant="primary" onClick={handleSearch} className="px-6">
          🔍 조회
        </Button>
      </div>
    </div>
  )
}
