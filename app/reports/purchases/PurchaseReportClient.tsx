'use client'

// ============================================================
// Phase 6: Purchase Report Client Component
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매 레포트 클라이언트 컴포넌트 (상태 관리, UI)
// ============================================================

import { useState, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getPurchaseReport } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, numberFormatter, decimalFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  PurchaseReportRow, 
  PURCHASE_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/ui/Card'
import { FormGrid } from '@/components/shared/FormGrid'

interface Props {
  userSession: UserData
  branches: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export default function PurchaseReportClient({ userSession, branches: initialBranches, categories: initialCategories }: Props) {
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
  const [reportData, setReportData] = useState<PurchaseReportRow[]>([])
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
      const response = await getPurchaseReport(newFilter)
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
   * 컬럼 정의 (그룹핑 방식에 따라 동적 변경)
   */
  const columnDefs = useMemo<ColDef<PurchaseReportRow>[]>(() => {
    const baseColumns: ColDef<PurchaseReportRow>[] = [
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
        headerName: '총 금액',
        field: 'total_amount',
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellStyle: { fontWeight: 'bold', color: '#1a56db' },
      },
      {
        headerName: '평균 단가',
        field: 'average_unit_cost',
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

    // 품목별/공급처별 그룹핑이 아닌 경우 품목 수 컬럼 추가
    if (filter.groupBy !== 'product' && filter.groupBy !== 'supplier') {
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
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* 필터 */}
      <ReportFilters
        initialFilter={filter}
        groupByOptions={PURCHASE_GROUP_BY_OPTIONS}
        onFilterChange={handleFilterChange}
        showBranchFilter={userSession.role === '0000'}
        branches={branches}
        categories={categories}
      />

      {/* 요약 카드 */}
      {reportData.length > 0 && !loading && (
        <FormGrid columns={4}>
          <StatCard
            label="총 수량"
            value={reportData.reduce((sum, row) => sum + row.total_quantity, 0)}
            variant="primary"
          />
          <StatCard
            label="총 금액"
            value={reportData.reduce((sum, row) => sum + row.total_amount, 0)}
            unit="원"
            variant="primary"
          />
          <StatCard
            label="총 거래 건수"
            value={reportData.reduce((sum, row) => sum + row.transaction_count, 0)}
            unit="건"
          />
          <StatCard
            label="평균 단가"
            value={(() => {
              const totalQty = reportData.reduce((sum, row) => sum + row.total_quantity, 0)
              const totalAmt = reportData.reduce((sum, row) => sum + row.total_amount, 0)
              return totalQty > 0 ? Math.round(totalAmt / totalQty) : 0
            })()}
            unit="원"
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
