'use client'

// ============================================================
// Phase 6: Report Grid Component (AG Grid)
// ============================================================
// 작성일: 2025-01-26
// 목적: 레포트 데이터 테이블 (AG Grid 기반)
// 참고: 구매/판매/이익 레포트 모두 공통 사용
// ============================================================

import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef } from 'ag-grid-community'

interface Props<T> {
  /** 레포트 데이터 */
  data: T[]
  /** 컬럼 정의 */
  columnDefs: ColDef[]
  /** 로딩 상태 */
  loading?: boolean
  /** 빈 데이터 메시지 */
  emptyMessage?: string
}

export default function ReportGrid<T>({
  data,
  columnDefs,
  loading = false,
  emptyMessage = '조회된 데이터가 없습니다.',
}: Props<T>) {
  // 기본 컬럼 설정
  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: false,
      suppressMovable: true,
    }),
    []
  )

  // 그리드 옵션
  const gridOptions = useMemo(
    () => ({
      pagination: false,
      domLayout: 'autoHeight' as const,
      animateRows: true,
      headerHeight: 48,
      rowHeight: 40,
    }),
    []
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border rounded">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2" />
          <p className="text-gray-900">데이터 조회 중...</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border rounded">
        <div className="text-center text-gray-900">
          <p className="text-lg mb-1">📊</p>
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ag-theme-alpine" style={{ width: '100%' }}>
      <AgGridReact
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        gridOptions={gridOptions}
        localeText={{
          // AG Grid 한글 번역
          noRowsToShow: emptyMessage,
          filterOoo: '필터...',
          equals: '같음',
          notEqual: '같지 않음',
          contains: '포함',
          notContains: '포함하지 않음',
          startsWith: '시작',
          endsWith: '끝',
          lessThan: '작음',
          lessThanOrEqual: '작거나 같음',
          greaterThan: '큼',
          greaterThanOrEqual: '크거나 같음',
        }}
      />
    </div>
  )
}

// ============================================================
// 숫자 포맷 유틸리티 (컬럼 정의에서 사용)
// ============================================================

/**
 * 금액 포맷터 (1000 → 1,000원)
 */
export function currencyFormatter(params: any): string {
  if (params.value == null || isNaN(params.value)) return '0원'
  return `${Math.round(params.value).toLocaleString('ko-KR')}원`
}

/**
 * 수량 포맷터 (1000 → 1,000)
 */
export function numberFormatter(params: any): string {
  if (params.value == null || isNaN(params.value)) return '0'
  return Math.round(params.value).toLocaleString('ko-KR')
}

/**
 * 소수점 포맷터 (12.345 → 12.35)
 */
export function decimalFormatter(params: any, decimals = 2): string {
  if (params.value == null || isNaN(params.value)) return '0.00'
  return parseFloat(params.value).toFixed(decimals)
}

/**
 * 퍼센트 포맷터 (12.34 → 12.34%)
 */
export function percentFormatter(params: any): string {
  if (params.value == null || isNaN(params.value)) return '0.00%'
  return `${parseFloat(params.value).toFixed(2)}%`
}
