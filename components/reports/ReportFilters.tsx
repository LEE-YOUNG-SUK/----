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
}

export default function ReportFilters({
  initialFilter,
  groupByOptions,
  onFilterChange,
  showBranchFilter = false,
  branches = [],
}: Props) {
  const [startDate, setStartDate] = useState(initialFilter.startDate)
  const [endDate, setEndDate] = useState(initialFilter.endDate)
  const [groupBy, setGroupBy] = useState(initialFilter.groupBy)
  const [branchId, setBranchId] = useState<string | null>(initialFilter.branchId || null)

  /**
   * 조회 버튼 클릭 핸들러
   */
  const handleSearch = () => {
    onFilterChange({
      startDate,
      endDate,
      groupBy,
      branchId: showBranchFilter ? branchId : null,
    })
  }

  /**
   * 빠른 날짜 선택 핸들러
   */
  const handleQuickDateRange = (range: 'today' | 'week' | 'month' | 'year') => {
    const today = new Date()
    const year = today.getFullYear()
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    switch (range) {
      case 'today':
        setStartDate(todayStr)
        setEndDate(todayStr)
        break
      case 'week': {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekYear = weekAgo.getFullYear()
        const weekMonth = (weekAgo.getMonth() + 1).toString().padStart(2, '0')
        const weekDay = weekAgo.getDate().toString().padStart(2, '0')
        setStartDate(`${weekYear}-${weekMonth}-${weekDay}`)
        setEndDate(todayStr)
        break
      }
      case 'month': {
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        const monthYear = monthAgo.getFullYear()
        const monthMonth = (monthAgo.getMonth() + 1).toString().padStart(2, '0')
        const monthDay = monthAgo.getDate().toString().padStart(2, '0')
        setStartDate(`${monthYear}-${monthMonth}-${monthDay}`)
        setEndDate(todayStr)
        break
      }
      case 'year': {
        setStartDate(`${year}-01-01`)
        setEndDate(todayStr)
        break
      }
    }
  }

  return (
    <div className="bg-white border rounded p-4 space-y-4">
      {/* 날짜 필터 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            시작일
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2 w-40"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            종료일
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2 w-40"
          />
        </div>

        {/* 빠른 날짜 선택 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleQuickDateRange('today')}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => handleQuickDateRange('week')}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            최근 7일
          </button>
          <button
            type="button"
            onClick={() => handleQuickDateRange('month')}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            최근 1개월
          </button>
          <button
            type="button"
            onClick={() => handleQuickDateRange('year')}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            올해
          </button>
        </div>
      </div>

      {/* 그룹핑 방식 & 지점 필터 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="groupBy" className="block text-sm font-medium text-gray-700 mb-1">
            그룹핑 방식
          </label>
          <select
            id="groupBy"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="border rounded px-3 py-2 w-40"
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
            <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-1">
              지점
            </label>
            <select
              id="branchId"
              value={branchId || ''}
              onChange={(e) => setBranchId(e.target.value || null)}
              className="border rounded px-3 py-2 w-40"
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

        {/* 조회 버튼 */}
        <button
          type="button"
          onClick={handleSearch}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          🔍 조회
        </button>
      </div>
    </div>
  )
}
