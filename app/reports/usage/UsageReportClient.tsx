'use client'

// ============================================================
// 재료비 레포트 클라이언트 컴포넌트
// ============================================================
// 작성일: 2025-01-26
// 목적: 사용(내부소모) 재료비 레포트 (상태 관리, UI)
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getUsageReport } from './actions'
import ReportFilters from '@/components/reports/ReportFilters'
import ReportGrid, { currencyFormatter, numberFormatter, decimalFormatter } from '@/components/reports/ReportGrid'
import { 
  ReportFilter, 
  SalesReportRow, // 구조가 유사하므로 재사용
  SALES_GROUP_BY_OPTIONS 
} from '@/types/reports'
import { UserData } from '@/types'
import { StatCard } from '@/components/ui/Card'
import { FormGrid } from '@/components/shared/FormGrid'
import { supabase } from '@/lib/supabase/client'

interface Props {
  userSession: UserData
}

// UsageReportRow는 SalesReportRow와 동일한 구조이지만 의미가 다름
type UsageReportRow = SalesReportRow

export default function UsageReportClient({ userSession }: Props) {
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
  const [reportData, setReportData] = useState<UsageReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])

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

  // 카테고리 목록 조회
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      if (!error && data) {
        setCategories(data)
      }
    }
    fetchCategories()
  }, [])

  /**
   * 필터 변경 핸들러
   */
  const handleFilterChange = async (newFilter: ReportFilter) => {
    setFilter(newFilter)
    setLoading(true)
    setError(null)

    try {
      const response = await getUsageReport(newFilter)
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
   * 컬럼 정의 (재료비 전용 - 이익 컬럼 제외)
   */
  const columnDefs = useMemo<ColDef<UsageReportRow>[]>(() => {
    const baseColumns: ColDef<UsageReportRow>[] = [
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
        headerName: '총 재료비',
        field: 'total_revenue', // total_revenue를 총 재료비로 표시
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellStyle: { fontWeight: 'bold', color: '#dc2626' }, // 빨간색 (비용)
      },
      {
        headerName: '평균 단가 (FIFO)',
        field: 'average_unit_price',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (params) => `${decimalFormatter(params, 0)}원`,
        cellStyle: { color: '#6b7280' },
      },
      {
        headerName: '사용 건수',
        field: 'transaction_count',
        width: 110,
        type: 'numericColumn',
        valueFormatter: numberFormatter,
      },
    ]

    // 품목별 그룹핑이 아닌 경우 품목 수 컬럼 추가
    if (filter.groupBy !== 'product') {
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

  // 그룹핑 옵션 필터링 (고객별 제외)
  const usageGroupByOptions = SALES_GROUP_BY_OPTIONS.filter(
    opt => opt.value !== 'customer'
  )

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
        groupByOptions={usageGroupByOptions}
        onFilterChange={handleFilterChange}
        showBranchFilter={userSession.role === '0000'}
        branches={branches}
        categories={categories}
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
          <FormGrid columns={3}>
            <StatCard
              label="총 사용 건수"
              value={reportData.reduce((sum, row) => sum + row.transaction_count, 0)}
              unit="건"
              variant="success"
            />
            <StatCard
              label="총 사용 수량"
              value={reportData.reduce((sum, row) => sum + row.total_quantity, 0)}
              unit="개"
            />
            <StatCard
              label="총 재료비"
              value={reportData.reduce((sum, row) => sum + row.total_revenue, 0)}
              unit="원"
              variant="danger"
            />
          </FormGrid>
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-700">
              💡 <strong>참고:</strong> 재료비는 FIFO 방식으로 계산된 평균 원가입니다. 
              사용(내부소모)은 이익이 0이므로 이익 컬럼이 표시되지 않습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

