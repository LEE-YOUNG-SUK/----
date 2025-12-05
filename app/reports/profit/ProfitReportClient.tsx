'use client'

// ============================================================
// Phase 6: Profit Report Client Component
// ============================================================
// 작성일: 2025-01-26
// 목적: 이익 레포트 클라이언트 컴포넌트 (상태 관리, UI)
// ============================================================

import { useState, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getProfitReport } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, percentFormatter, numberFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  ProfitReportRow, 
  PROFIT_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/ui/Card'
import { FormGrid } from '@/components/shared/FormGrid'

interface Props {
  userSession: UserData
}

export default function ProfitReportClient({ userSession }: Props) {
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
  const [reportData, setReportData] = useState<ProfitReportRow[]>([])
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
      const response = await getProfitReport(newFilter)
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
  const columnDefs = useMemo<ColDef<ProfitReportRow>[]>(() => [
    {
      headerName: '구분',
      field: 'group_label',
      width: 200,
      pinned: 'left',
      cellStyle: () => ({ fontWeight: 'bold' }),
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
      headerName: '총 매출',
      field: 'total_revenue',
      width: 150,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ fontWeight: 'bold', color: '#047857' }),
    },
    {
      headerName: '총 원가',
      field: 'total_cost',
      width: 150,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#dc2626' }),
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
      headerName: '이익률',
      field: 'profit_margin',
      width: 120,
      type: 'numericColumn',
      valueFormatter: percentFormatter,
      cellStyle: (params) => ({
        fontWeight: 'bold',
        color: params.value >= 0 ? '#047857' : '#dc2626',
      }),
    },
    {
      headerName: '거래 건수',
      field: 'transaction_count',
      width: 110,
      type: 'numericColumn',
      valueFormatter: numberFormatter,
    },
    {
      headerName: '품목 수',
      field: 'product_count',
      width: 100,
      type: 'numericColumn',
      valueFormatter: numberFormatter,
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* 오류 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* 필터 */}
      <ReportFilters
        initialFilter={filter}
        groupByOptions={PROFIT_GROUP_BY_OPTIONS}
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
          <FormGrid columns={4}>
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
              label="평균 이익률"
              value={(() => {
                const totalRevenue = reportData.reduce((sum, row) => sum + row.total_revenue, 0)
                const totalProfit = reportData.reduce((sum, row) => sum + row.total_profit, 0)
                return totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00'
              })()}
              unit="%"
              variant="success"
            />
          </FormGrid>
        </div>
      )}
    </div>
  )
}
