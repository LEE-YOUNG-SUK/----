'use server'

// ============================================================
// Phase 6: Summary Report (종합 레포트) - Server Actions
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매/사용/판매 통합 레포트 조회
// 변경: 이익 레포트 → 종합 레포트
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { ReportFilter } from '@/types/reports'
import { validateDateRange } from '@/lib/date-utils'

// 종합 레포트 행 타입
export interface SummaryReportRow {
  group_key: string
  group_label: string
  purchase_quantity: number  // 구매수량
  purchase_amount: number    // 구매금액
  usage_amount: number       // 사용금액
  sale_quantity: number      // 판매수량
  sale_amount: number        // 판매금액
  sale_cost: number          // 판매원가
  sale_profit: number        // 판매이익
  profit_margin: number      // 이익률
}

// 종합 레포트 응답 타입
export interface SummaryReportResponse {
  success: boolean
  data: SummaryReportRow[]
  error?: string
  filter: ReportFilter
}

/**
 * 종합 레포트 조회 Server Action
 * @param filter - 레포트 필터 조건 (시작일, 종료일, 그룹핑 방식, 지점ID)
 * @returns SummaryReportResponse - 성공 여부, 데이터, 오류 메시지
 */
export async function getSummaryReport(
  filter: ReportFilter
): Promise<SummaryReportResponse> {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], error: '로그인이 필요합니다.', filter }
    }

    if (!['0000', '0001', '0002'].includes(session.role)) {
      return { success: false, data: [], error: '레포트 조회 권한이 없습니다.', filter }
    }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [], error: dateError, filter }

    // 비관리자는 본인 지점만 조회 가능
    const branchId = session.role === '0000' ? (filter.branchId || null) : session.branch_id

    const supabase = await createServerClient()

    const { data: reportData, error: reportError } = await supabase.rpc(
      'get_summary_report',
      {
        p_user_role: session.role,
        p_branch_id: branchId,
        p_start_date: filter.startDate,
        p_end_date: filter.endDate,
        p_group_by: filter.groupBy,
        p_category_id: filter.categoryId || null  // ✅ 추가: 카테고리 필터
      }
    )

    if (reportError) {
      console.error('Summary report RPC error:', reportError)
      return {
        success: false,
        data: [],
        error: `레포트 조회 중 오류가 발생했습니다: ${reportError.message}`,
        filter,
      }
    }

    // 5. 데이터 매핑 (RPC 응답 → TypeScript 타입)
    const mappedData: SummaryReportRow[] = (reportData || []).map((item: any) => ({
      group_key: item.group_key,
      group_label: item.group_label,
      purchase_quantity: parseFloat(item.purchase_quantity) || 0,
      purchase_amount: parseFloat(item.purchase_amount) || 0,
      usage_amount: parseFloat(item.usage_amount) || 0,
      sale_quantity: parseFloat(item.sale_quantity) || 0,
      sale_amount: parseFloat(item.sale_amount) || 0,
      sale_cost: parseFloat(item.sale_cost) || 0,
      sale_profit: parseFloat(item.sale_profit) || 0,
      profit_margin: parseFloat(item.profit_margin) || 0,
    }))

    return {
      success: true,
      data: mappedData,
      filter,
    }
  } catch (error) {
    console.error('getSummaryReport error:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      filter,
    }
  }
}

// 하위 호환성을 위해 getProfitReport를 getSummaryReport로 리다이렉트
export const getProfitReport = getSummaryReport
