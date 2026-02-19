'use server'

// ============================================================
// Phase 6: Purchase Report - Server Actions
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매 레포트 조회 Server Action
// 패턴: 세션 검증 → 권한 체크 → RPC 호출 → revalidatePath
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import {
  PurchaseReportResponse,
  PurchaseReportRow,
  ReportFilter
} from '@/types/reports'
import { validateDateRange } from '@/lib/date-utils'

export async function getPurchaseReport(
  filter: ReportFilter
): Promise<PurchaseReportResponse> {
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
    const branchId = session.is_headquarters && ['0000', '0001'].includes(session.role) ? (filter.branchId || null) : session.branch_id

    const supabase = await createServerClient()

    const { data: reportData, error: reportError } = await supabase.rpc(
      'get_purchase_report',
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
      console.error('Purchase report RPC error:', reportError)
      return {
        success: false,
        data: [],
        error: `레포트 조회 중 오류가 발생했습니다: ${reportError.message}`,
        filter,
      }
    }

    // 5. 데이터 매핑 (RPC 응답 → TypeScript 타입)
    const mappedData: PurchaseReportRow[] = (reportData || []).map((item: any) => ({
      group_key: item.group_key,
      group_label: item.group_label,
      total_quantity: parseFloat(item.total_quantity) || 0,
      total_amount: parseFloat(item.total_amount) || 0,
      transaction_count: parseInt(item.transaction_count, 10) || 0,
      average_unit_cost: parseFloat(item.average_unit_cost) || 0,
      product_count: parseInt(item.product_count, 10) || 0,
    }))

    return {
      success: true,
      data: mappedData,
      filter,
    }
  } catch (error) {
    console.error('getPurchaseReport error:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      filter,
    }
  }
}
