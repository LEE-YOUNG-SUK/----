'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type {
  B2bOutstandingReportItem,
  B2bSettlementReportItem,
  B2bDashboardStats,
} from '@/types/b2b'

/**
 * 미수 리포트 조회
 */
export async function getOutstandingReport(filters?: {
  from_date?: string
  to_date?: string
  branch_id?: string
}) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bOutstandingReportItem[], message: '인증되지 않은 사용자입니다.' }
    }

    // 본사(0000) 또는 원장(0001)만 조회 가능
    if (session.role !== '0000' && session.role !== '0001') {
      return { success: false, data: [] as B2bOutstandingReportItem[], message: '권한이 없습니다.' }
    }

    const supabase = await createServerClient()

    // 원장은 본인 지점만
    const branchId = session.role === '0001' ? session.branch_id : (filters?.branch_id || null)

    const { data, error } = await supabase.rpc('b2b_get_outstanding_report', {
      p_from_date: filters?.from_date || null,
      p_to_date: filters?.to_date || null,
      p_branch_id: branchId
    })

    if (error) {
      return { success: false, data: [] as B2bOutstandingReportItem[], message: `미수 리포트 조회 실패: ${error.message}` }
    }

    const items: B2bOutstandingReportItem[] = (data || []).map((row: any) => ({
      order_id: row.order_id,
      order_number: row.order_number,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      total_price: row.total_price,
      settled_amount: row.settled_amount,
      outstanding_amount: row.outstanding_amount,
      settlement_rate: row.settlement_rate,
      aging_days: row.aging_days,
      created_at: row.created_at,
    }))

    return { success: true, data: items }
  } catch (error) {
    return {
      success: false,
      data: [] as B2bOutstandingReportItem[],
      message: error instanceof Error ? error.message : '미수 리포트 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 정산 리포트 조회 (지점별 집계)
 */
export async function getSettlementReport(filters?: {
  from_date?: string
  to_date?: string
  branch_id?: string
}) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bSettlementReportItem[], message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000' && session.role !== '0001') {
      return { success: false, data: [] as B2bSettlementReportItem[], message: '권한이 없습니다.' }
    }

    const supabase = await createServerClient()

    const branchId = session.role === '0001' ? session.branch_id : (filters?.branch_id || null)

    const { data, error } = await supabase.rpc('b2b_get_settlement_report', {
      p_from_date: filters?.from_date || null,
      p_to_date: filters?.to_date || null,
      p_branch_id: branchId
    })

    if (error) {
      return { success: false, data: [] as B2bSettlementReportItem[], message: `정산 리포트 조회 실패: ${error.message}` }
    }

    const items: B2bSettlementReportItem[] = (data || []).map((row: any) => ({
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      total_orders: row.total_orders,
      total_amount: row.total_amount,
      total_settled: row.total_settled,
      total_outstanding: row.total_outstanding,
      settlement_rate: row.settlement_rate,
    }))

    return { success: true, data: items }
  } catch (error) {
    return {
      success: false,
      data: [] as B2bSettlementReportItem[],
      message: error instanceof Error ? error.message : '정산 리포트 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 대시보드 통계 조회
 */
export async function getDashboardStats(branchId?: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000' && session.role !== '0001') {
      return { success: false, data: null, message: '권한이 없습니다.' }
    }

    const supabase = await createServerClient()

    const effectiveBranchId = session.role === '0001' ? session.branch_id : (branchId || null)

    const { data, error } = await supabase.rpc('b2b_get_dashboard_stats', {
      p_branch_id: effectiveBranchId
    })

    if (error) {
      return { success: false, data: null, message: `대시보드 통계 조회 실패: ${error.message}` }
    }

    if (!data || data.length === 0) {
      return { success: true, data: { pending_orders: 0, active_orders: 0, total_outstanding: 0, monthly_sales: 0 } }
    }

    const row = data[0]
    const stats: B2bDashboardStats = {
      pending_orders: row.pending_orders,
      active_orders: row.active_orders,
      total_outstanding: row.total_outstanding,
      monthly_sales: row.monthly_sales,
    }

    return { success: true, data: stats }
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '대시보드 통계 조회 중 오류가 발생했습니다.'
    }
  }
}
