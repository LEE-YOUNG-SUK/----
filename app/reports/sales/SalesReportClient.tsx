'use client'

// ============================================================
// Phase 6: Sales Report Client Component
// ============================================================
// 작성일: 2025-01-26
// 목적: 판매 레포트 클라이언트 컴포넌트 (상태 관리, UI)
// ============================================================

import { useState, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getSalesReport } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, numberFormatter, decimalFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  SalesReportRow, 
  SALES_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/shared/StatCard'
import { FormGrid } from '@/components/shared/FormGrid'

interface Props {
  userSession: UserData
}

export default function SalesReportClient({ userSession }: Props) {
  // 초기 필터: 최근 1개월, 월별 그룹핑
  const getDefaultFilter = (): ReportFilter => {
    const today = new Date()
    const oneMonthAgo = new Date(today)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    return {
      startDate: oneMonthAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      groupBy: 'monthly',
      branchId: userSession.branch_id || null,
    }
  }

  const [filter, setFilter] = useState<ReportFilter>(getDefaultFilter())
  const [reportData, setReportData] = useState<SalesReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 필터 변경 핸들러
   */
  const handleFilterChange = async (newFilter: ReportFilter) => {
    setFilter(newFilter)
    setLoading(true)
    setError(null)

    try {
      const response = await getSalesReport(newFilter)
      if (response.success) {
        setReportData(response.data)
      } else {
        setError(response.error || '레포트 조회 실패')
      }
    } catch (err) {
      console.error('Report fetch error:', err)
      setError('레포트 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 컬럼 정의
   */
  const columnDefs = useMemo<ColDef<SalesReportRow>[]>(() => {
    const baseColumns: ColDef<SalesReportRow>[] = [
      {
        headerName: '구분',
        field: 'group_label',
        width: 200,
        pinned: 'left',
        cellStyle: { fontWeight: 'bold' },
        valueFormatter: (params) => {
          // monthly 그룹핑: 2025-01 → 2025년 01월
          if (filter.groupBy === 'monthly' && params.value?.match(/^\d{4}-\d{2}$/)) {
            const [year, month] = params.value.split('-')
            return `${year}년 ${month}월`
          }
          return params.value
        },
      },
      {
        headerName: '총 수량',
        field: 'total_quantity',
        width: 120,
        type: 'numericColumn',
        valueFormatter: numberFormatter,
      },
      {
        headerName: '총 매출',
        field: 'total_revenue',
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellStyle: { fontWeight: 'bold', color: '#047857' },
      },
      {
        headerName: '총 원가',
        field: 'total_cost',
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellStyle: { color: '#dc2626' },
      },
      {
        headerName: '총 이익',
        field: 'total_profit',
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellStyle: (params) => ({
          fontWeight: 'bold',
          color: params.value >= 0 ? '#1a56db' : '#dc2626',
        }),
      },
      {
        headerName: '평균 단가',
        field: 'average_unit_price',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (params) => `${decimalFormatter(params, 0)}원`,
      },
      {
        headerName: '거래 건수',
        field: 'transaction_count',
        width: 110,
        type: 'numericColumn',
        valueFormatter: numberFormatter,
      },
    ]

    // 품목별/고객별 그룹핑이 아닌 경우 품목 수 컬럼 추가
    if (filter.groupBy !== 'product' && filter.groupBy !== 'customer') {
      baseColumns.push({
        headerName: '품목 수',
        field: 'product_count',
        width: 100,
        type: 'numericColumn',
        valueFormatter: numberFormatter,
      })
    }

    return baseColumns
  }, [filter.groupBy])

  return (
    <div className="space-y-6">
      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
          ⚠️ {error}
        </div>
      )}

      {/* 필터 */}
      <ReportFilters
        initialFilter={filter}
        groupByOptions={SALES_GROUP_BY_OPTIONS}
        onFilterChange={handleFilterChange}
        showBranchFilter={userSession.role === '0000'}
        branches={[]}
      />

      {/* 레포트 그리드 */}
      <ReportGrid
        data={reportData}
        columnDefs={columnDefs}
        loading={loading}
        emptyMessage="조회 버튼을 클릭하여 레포트를 조회하세요."
      />

      {/* 요약 정보 */}
      {reportData.length > 0 && !loading && (
        <div>
          <h3 className="font-bold text-gray-700 mb-3">📈 요약</h3>
          <FormGrid columns={5}>
            <StatCard
              label="총 수량"
              value={reportData.reduce((sum, row) => sum + row.total_quantity, 0)}
              variant="success"
            />
            <StatCard
              label="총 매출"
              value={reportData.reduce((sum, row) => sum + row.total_revenue, 0)}
              unit="원"
              variant="success"
            />
            <StatCard
              label="총 원가"
              value={reportData.reduce((sum, row) => sum + row.total_cost, 0)}
              unit="원"
            />
            <StatCard
              label="총 이익"
              value={reportData.reduce((sum, row) => sum + row.total_profit, 0)}
              unit="원"
              variant="primary"
            />
            <StatCard
              label="총 거래 건수"
              value={reportData.reduce((sum, row) => sum + row.transaction_count, 0)}
              unit="건"
            />
          </FormGrid>
        </div>
      )}
    </div>
  )
}
