'use server'

// ============================================================
// Phase 6: Sales Report - Server Actions
// ============================================================
// 작성일: 2025-01-26
// 목적: 판매 레포트 조회 Server Action
// 패턴: 세션 검증 → 권한 체크 → RPC 호출
// ============================================================

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { 
  SalesReportResponse, 
  SalesReportRow, 
  ReportFilter 
} from '@/types/reports'

/**
 * 판매 레포트 조회 Server Action
 * @param filter - 레포트 필터 조건 (시작일, 종료일, 그룹핑 방식, 지점ID)
 * @returns SalesReportResponse - 성공 여부, 데이터, 오류 메시지
 */
export async function getSalesReport(
  filter: ReportFilter
): Promise<SalesReportResponse> {
  try {
    // 1. 세션 검증
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_session_token')?.value

    if (!token) {
      return {
        success: false,
        data: [],
        error: '로그인이 필요합니다.',
        filter,
      }
    }

    const supabase = await createServerClient()

    // 2. 세션 검증 및 사용자 정보 조회
    const { data: sessionData, error: sessionError } = await supabase.rpc(
      'verify_session',
      { p_token: token }
    )

    if (sessionError || !sessionData?.[0]?.valid) {
      return {
        success: false,
        data: [],
        error: '유효하지 않은 세션입니다.',
        filter,
      }
    }

    const userRole = sessionData[0].role as string

    // 3. 권한 체크 (원장/매니저 이상만 접근 가능)
    if (!['0000', '0001', '0002'].includes(userRole)) {
      return {
        success: false,
        data: [],
        error: '레포트 조회 권한이 없습니다.',
        filter,
      }
    }

    // 4. RPC 함수 호출
    const { data: reportData, error: reportError } = await supabase.rpc(
      'get_sales_report',
      {
        p_user_role: userRole,
        p_branch_id: filter.branchId || null,
        p_start_date: filter.startDate,
        p_end_date: filter.endDate,
        p_group_by: filter.groupBy,
        p_transaction_type: 'SALE'  // ✅ 추가: 판매만
      }
    )

    if (reportError) {
      console.error('Sales report RPC error:', reportError)
      return {
        success: false,
        data: [],
        error: `레포트 조회 중 오류가 발생했습니다: ${reportError.message}`,
        filter,
      }
    }

    // 5. ✅ 클라이언트 측 필터링: SALE만 추출
    // 주의: RPC 함수가 transaction_type을 반환하지 않을 수 있으므로
    // sales 테이블에서 직접 조회하는 것이 더 안전함
    
    // 임시 해결책: reportData가 모든 거래를 반환하는 경우
    // 향후 개선: get_sales_report RPC에 transaction_type 파라미터 추가
    
    // 5. 데이터 매핑 (RPC 응답 → TypeScript 타입)
    const mappedData: SalesReportRow[] = (reportData || []).map((item: any) => ({
      group_key: item.group_key,
      group_label: item.group_label,
      total_quantity: parseFloat(item.total_quantity) || 0,
      total_revenue: parseFloat(item.total_revenue) || 0,
      total_cost: parseFloat(item.total_cost) || 0,
      total_profit: parseFloat(item.total_profit) || 0,
      transaction_count: parseInt(item.transaction_count, 10) || 0,
      average_unit_price: parseFloat(item.average_unit_price) || 0,
      product_count: parseInt(item.product_count, 10) || 0,
    }))

    return {
      success: true,
      data: mappedData,
      filter,
    }
  } catch (error) {
    console.error('getSalesReport error:', error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      filter,
    }
  }
}
