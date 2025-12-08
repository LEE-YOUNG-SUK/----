'use client'

// ============================================================
// 종합 레포트 클라이언트 컴포넌트
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매/사용/판매 통합 레포트 (상태 관리, UI)
// 변경: 이익 레포트 → 종합 레포트
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getSummaryReport, type SummaryReportRow } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, percentFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  PROFIT_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/ui/Card'
import { FormGrid } from '@/components/shared/FormGrid'
import { supabase } from '@/lib/supabase/client'

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
  const [reportData, setReportData] = useState<SummaryReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])

  // 지점 목록 조회 (시스템 관리자만)
  useEffect(() => {
    if (userSession.role === '0000') {
      const fetchBranches = async () => {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        
        if (!error && data) {
          setBranches(data)
        }
      }
      fetchBranches()
    }
  }, [userSession.role])

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
      headerName: '구매금액',
      field: 'purchase_amount',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#3B82F6' }),  // 파란색
    },
    {
      headerName: '사용금액',
      field: 'usage_amount',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#F59E0B' }),  // 주황색
    },
    {
      headerName: '판매금액',
      field: 'sale_amount',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#10B981', fontWeight: 'bold' }),  // 초록색
    },
    {
      headerName: '판매원가',
      field: 'sale_cost',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: () => ({ color: '#6B7280' }),  // 회색
    },
    {
      headerName: '판매이익',
      field: 'sale_profit',
      width: 140,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellStyle: (params) => ({
        fontWeight: 'bold',
        color: params.value >= 0 ? '#10B981' : '#DC2626',
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
        color: params.value >= 0 ? '#8B5CF6' : '#DC2626',  // 보라색
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
        showBranchFilter={userSession.role === '0000'}
        branches={branches}
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
          <h3 className="font-bold text-gray-700 mb-3">📊 요약</h3>
          <FormGrid columns={4}>
            <StatCard
              label="총 구매금액"
              value={reportData.reduce((sum, row) => sum + row.purchase_amount, 0)}
              unit="원"
              variant="primary"
            />
            <StatCard
              label="총 사용금액"
              value={reportData.reduce((sum, row) => sum + row.usage_amount, 0)}
              unit="원"
              variant="warning"
            />
            <StatCard
              label="총 판매금액"
              value={reportData.reduce((sum, row) => sum + row.sale_amount, 0)}
              unit="원"
              variant="success"
            />
            <StatCard
              label="총 판매이익"
              value={reportData.reduce((sum, row) => sum + row.sale_profit, 0)}
              unit="원"
              variant="success"
            />
          </FormGrid>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>참고:</strong> 구매금액은 입고 비용, 사용금액은 내부소모 재료비, 판매금액은 고객 판매 수익을 나타냅니다. 이익률은 판매이익/판매금액으로 계산됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
