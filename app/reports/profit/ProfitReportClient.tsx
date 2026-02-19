'use client'

// ============================================================
// 종합 레포트 클라이언트 컴포넌트
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매/사용/판매 통합 레포트 (상태 관리, UI)
// 변경: 이익 레포트 → 종합 레포트
// ============================================================

import { useState, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getSummaryReport, type SummaryReportRow } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, numberFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  PROFIT_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/ui/Card'
import { FormGrid } from '@/components/shared/FormGrid'
interface Props {
  userSession: UserData
  branches: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export default function ProfitReportClient({ userSession, branches: initialBranches, categories: initialCategories }: Props) {
  // 초기 필터: 최근 1개월, 월별 그룹핑
  const getDefaultFilter = (): ReportFilter => {
    const today = new Date()
    const oneMonthAgo = new Date(today)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    return {
      startDate: oneMonthAgo.toLocaleDateString('sv-SE'),
      endDate: today.toLocaleDateString('sv-SE'),
      groupBy: 'monthly',
      branchId: userSession.branch_id || null,
    }
  }

  const [filter, setFilter] = useState<ReportFilter>(getDefaultFilter())
  const [reportData, setReportData] = useState<SummaryReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branches] = useState<{id: string, name: string}[]>(initialBranches)
  const [categories] = useState<{id: string, name: string}[]>(initialCategories)

  /**
   * 필터 변경 핸들러
   */
  const handleFilterChange = async (newFilter: ReportFilter) => {
    setFilter(newFilter)
    setLoading(true)
    setError(null)

    try {
      const response = await getSummaryReport(newFilter)
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
  const columnDefs = useMemo<ColDef<SummaryReportRow>[]>(() => [
    {
      headerName: '구분',
      field: 'group_label',
      width: 140,
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
      headerName: '구매수량',
      field: 'purchase_quantity',
      width: 120,
      type: 'numericColumn',
      valueFormatter: numberFormatter,
    },
    {
      headerName: '구매금액',
      field: 'purchase_amount',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#3B82F6' }),
    },
    {
      headerName: '판매수량',
      field: 'sale_quantity',
      width: 120,
      type: 'numericColumn',
      valueFormatter: numberFormatter,
    },
    {
      headerName: '판매금액',
      field: 'sale_amount',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#10B981', fontWeight: 'bold' }),
    },
    {
      headerName: '판매원가',
      field: 'sale_cost',
      width: 130,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
    },
    {
      headerName: '판매이익',
      field: 'sale_profit',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: (params) => ({
        fontWeight: 'bold',
        color: (params.value ?? 0) >= 0 ? '#10B981' : '#DC2626',
      }),
    },
    {
      headerName: '이익률',
      field: 'profit_margin',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (params) => {
        if (params.value == null || isNaN(params.value)) return '0.0%'
        return `${parseFloat(params.value).toFixed(1)}%`
      },
      cellStyle: (params) => ({
        fontWeight: 'bold',
        color: (params.value ?? 0) >= 0 ? '#10B981' : '#DC2626',
      }),
    },
  ], [filter.groupBy])

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
        showBranchFilter={userSession.is_headquarters && ['0000', '0001'].includes(userSession.role)}
        branches={branches}
        categories={categories}
      />

      {/* 요약 카드 */}
      {reportData.length > 0 && !loading && (
        <FormGrid columns={5}>
          <StatCard
            label="총 구매수량"
            value={reportData.reduce((sum, row) => sum + row.purchase_quantity, 0)}
            variant="primary"
          />
          <StatCard
            label="총 구매금액"
            value={reportData.reduce((sum, row) => sum + row.purchase_amount, 0)}
            unit="원"
            subtitle="부가세포함"
            variant="primary"
          />
          <StatCard
            label="총 판매수량"
            value={reportData.reduce((sum, row) => sum + row.sale_quantity, 0)}
            variant="success"
          />
          <StatCard
            label="총 판매금액"
            value={reportData.reduce((sum, row) => sum + row.sale_amount, 0)}
            unit="원"
            subtitle="부가세포함"
            variant="success"
          />
          <StatCard
            label="총 판매이익"
            value={reportData.reduce((sum, row) => sum + row.sale_profit, 0)}
            unit="원"
            subtitle="판매금액-판매원가"
            variant="success"
          />
        </FormGrid>
      )}

      {/* 레포트 그리드 */}
      <ReportGrid
        data={reportData}
        columnDefs={columnDefs}
        loading={loading}
        emptyMessage="조회 버튼을 클릭하여 레포트를 조회하세요."
      />
    </div>
  )
}
