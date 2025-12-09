'use server'

// ============================================================
// 재료비 레포트 - Server Actions
// ============================================================
// 작성일: 2025-01-26
// 목적: 사용(내부소모) 재료비 레포트 조회 Server Action
// 패턴: 세션 검증 → 권한 체크 → RPC 호출 (USAGE 필터 추가)
// ============================================================

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { 
  SalesReportResponse, 
  SalesReportRow, 
  ReportFilter 
} from '@/types/reports'

/**
 * 재료비 레포트 조회 Server Action
 * @param filter - 레포트 필터 조건 (시작일, 종료일, 그룹핑 방식, 지점ID)
 * @returns SalesReportResponse - 성공 여부, 데이터, 오류 메시지
 * 
 * ✅ 판매 레포트와 동일한 RPC 함수 사용하되, transaction_type='USAGE'만 필터링
 */
export async function getUsageReport(
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
    const userBranchId = sessionData[0].branch_id

    // 3. 권한 체크 (원장/매니저 이상만 접근 가능)
    if (!['0000', '0001', '0002'].includes(userRole)) {
      return {
        success: false,
        data: [],
        error: '레포트 조회 권한이 없습니다.',
        filter,
      }
    }

    // 4. 지점 필터 처리 (권한에 따라)
    let targetBranchId: string | null = null
    if (userRole === '0000') {
      // 시스템 관리자: 선택한 지점 또는 전체
      targetBranchId = filter.branchId || null
    } else {
      // 원장/매니저: 본인 지점만
      targetBranchId = userBranchId
    }

    // 5. RPC 함수 호출 (판매 레포트와 동일한 함수 사용)
    const { data: reportData, error: reportError } = await supabase.rpc(
      'get_sales_report',
      {
        p_user_role: userRole,
        p_branch_id: targetBranchId,
        p_start_date: filter.startDate,
        p_end_date: filter.endDate,
        p_group_by: filter.groupBy,
        p_transaction_type: 'USAGE',  // ✅ 추가: 사용(내부소모)만
        p_category_id: filter.categoryId || null  // ✅ 추가: 카테고리 필터
      }
    )

    if (reportError) {
      console.error('Usage report RPC error:', reportError)
      return {
        success: false,
        data: [],
        error: `레포트 조회 중 오류가 발생했습니다: ${reportError.message}`,
        filter,
      }
    }

    // 6. ✅ 클라이언트 측 필터링: USAGE만 추출
    // 주의: RPC 함수가 transaction_type 필터를 지원하지 않는 경우,
    // sales 테이블에서 직접 조회하는 방식으로 변경 필요
    
    // 방법 1: RPC 결과를 클라이언트에서 필터링 (임시)
    // 방법 2: 새로운 RPC 함수 생성 (get_usage_report) - 권장
    
    // 현재는 방법 2로 구현: sales 테이블에서 직접 조회
    const { data: usageData, error: usageError } = await supabase
      .from('sales')
      .select(`
        sale_date,
        product_id,
        quantity,
        unit_price,
        total_price,
        cost_of_goods_sold,
        profit,
        products (
          id,
          code,
          name
        ),
        branches (
          id,
          name
        )
      `)
      .eq('transaction_type', 'USAGE')
      .gte('sale_date', filter.startDate)
      .lte('sale_date', filter.endDate)
      .order('sale_date', { ascending: false })

    if (usageError) {
      console.error('Usage data fetch error:', usageError)
      return {
        success: false,
        data: [],
        error: `재료비 조회 중 오류가 발생했습니다: ${usageError.message}`,
        filter,
      }
    }

    // 7. 데이터 그룹핑 및 집계 (클라이언트 측)
    const groupedData = groupUsageData(usageData || [], filter.groupBy)

    return {
      success: true,
      data: groupedData,
      filter,
    }
  } catch (error) {
    console.error('Unexpected error in getUsageReport:', error)
    return {
      success: false,
      data: [],
      error: '예상치 못한 오류가 발생했습니다.',
      filter,
    }
  }
}

/**
 * 사용 데이터 그룹핑 및 집계 함수
 */
function groupUsageData(
  data: any[],
  groupBy: string
): SalesReportRow[] {
  const grouped = new Map<string, {
    label: string  // ✅ 추가: label 저장
    quantity: number
    revenue: number
    cost: number
    count: number
    products: Set<string>
  }>()

  data.forEach((row) => {
    let key: string
    let label: string

    switch (groupBy) {
      case 'daily':
        key = row.sale_date
        label = row.sale_date
        break
      case 'monthly':
        key = row.sale_date.substring(0, 7) // YYYY-MM
        label = key
        break
      case 'product':
        key = row.product_id
        label = row.products?.name || '알 수 없음'
        break
      default:
        key = row.sale_date
        label = row.sale_date
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        label: label,  // ✅ label 저장
        quantity: 0,
        revenue: 0,
        cost: 0,
        count: 0,
        products: new Set(),
      })
    }

    const group = grouped.get(key)!
    group.quantity += parseFloat(row.quantity) || 0
    group.revenue += parseFloat(row.total_price) || 0
    group.cost += parseFloat(row.cost_of_goods_sold) || 0
    group.count += 1
    if (row.product_id) {
      group.products.add(row.product_id)
    }
  })

  // Map을 SalesReportRow 배열로 변환
  return Array.from(grouped.entries()).map(([key, group]) => ({
    group_key: key,
    group_label: group.label,  // ✅ 수정: 저장된 label 사용
    total_quantity: group.quantity,
    total_revenue: group.revenue,
    total_cost: group.cost,
    total_profit: 0, // USAGE는 이익이 항상 0
    transaction_count: group.count,
    average_unit_price: group.quantity > 0 ? group.revenue / group.quantity : 0,
    product_count: group.products.size,
  }))
}

