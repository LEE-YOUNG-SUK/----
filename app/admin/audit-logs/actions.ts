'use server'

/**
 * Audit Log 관리 Server Actions (Phase 3-4)
 */

import { createServerClient } from '@/lib/supabase/server'
import type { AuditLogFilter } from '@/types/audit'

/**
 * 감사 로그 목록 조회
 * 권한: 원장(0001) 이상
 */
export async function getAuditLogs(
  userId: string,
  userRole: string,
  userBranchId: string | null,
  filters?: AuditLogFilter
) {
  try {
    const supabase = await createServerClient()

    // 권한 사전 체크
    if (!['0000', '0001'].includes(userRole)) {
      return {
        success: false,
        data: [],
        message: '감사 로그 조회 권한이 없습니다. (원장 이상 필요)'
      }
    }

    const { data, error } = await supabase.rpc('get_audit_logs', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_table_name: filters?.table_name || null,
      p_action: filters?.action || null,
      p_filter_branch_id: filters?.branch_id || null,
      p_filter_user_id: filters?.user_id || null,
      p_start_date: filters?.start_date || null,
      p_end_date: filters?.end_date || null
    })

    if (error) {
      console.error('❌ Get audit logs error:', error)
      throw error
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get audit logs error:', error)
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '감사 로그 조회 실패'
    }
  }
}

/**
 * 특정 레코드 변경 이력 조회
 * 권한: 원장(0001) 이상
 */
export async function getRecordHistory(
  userId: string,
  userRole: string,
  userBranchId: string | null,
  recordId: string,
  tableName: string
) {
  try {
    const supabase = await createServerClient()

    // 권한 사전 체크
    if (!['0000', '0001'].includes(userRole)) {
      return {
        success: false,
        data: [],
        message: '감사 로그 조회 권한이 없습니다. (원장 이상 필요)'
      }
    }

    const { data, error } = await supabase.rpc('get_record_history', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_record_id: recordId,
      p_table_name: tableName
    })

    if (error) {
      console.error('❌ Get record history error:', error)
      throw error
    }

    // 입고/판매 테이블인 경우 품목명 추가
    if ((tableName === 'purchases' || tableName === 'sales') && data && data.length > 0) {
      // product_id 수집
      const productIds = new Set<string>()
      data.forEach((log: any) => {
        if (log.old_data?.product_id) productIds.add(log.old_data.product_id)
        if (log.new_data?.product_id) productIds.add(log.new_data.product_id)
      })

      // 품목명 조회
      if (productIds.size > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', Array.from(productIds))

        const productMap: Record<string, string> = {}
        products?.forEach((p: any) => {
          productMap[p.id] = p.name
        })

        // 로그에 품목명 추가
        data.forEach((log: any) => {
          if (log.old_data?.product_id) {
            log.old_data.product_name = productMap[log.old_data.product_id] || '알 수 없음'
          }
          if (log.new_data?.product_id) {
            log.new_data.product_name = productMap[log.new_data.product_id] || '알 수 없음'
          }
        })
      }
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get record history error:', error)
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '변경 이력 조회 실패'
    }
  }
}

/**
 * 감사 로그 통계 조회
 * 권한: 원장(0001) 이상
 */
export async function getAuditStats(
  userId: string,
  userRole: string,
  userBranchId: string | null,
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()

    // 권한 사전 체크
    if (!['0000', '0001'].includes(userRole)) {
      return {
        success: false,
        data: [],
        message: '감사 로그 통계 조회 권한이 없습니다. (원장 이상 필요)'
      }
    }

    const { data, error } = await supabase.rpc('get_audit_stats', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    })

    if (error) {
      console.error('❌ Get audit stats error:', error)
      throw error
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get audit stats error:', error)
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '감사 로그 통계 조회 실패'
    }
  }
}

/**
 * 사용자별 활동 조회
 * 권한: 원장(0001) 이상
 */
export async function getUserActivity(
  userId: string,
  userRole: string,
  userBranchId: string | null,
  targetUserId?: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()

    // 권한 사전 체크
    if (!['0000', '0001'].includes(userRole)) {
      return {
        success: false,
        data: [],
        message: '사용자 활동 조회 권한이 없습니다. (원장 이상 필요)'
      }
    }

    const { data, error } = await supabase.rpc('get_user_activity', {
      p_user_id: userId,
      p_user_role: userRole,
      p_user_branch_id: userBranchId,
      p_target_user_id: targetUserId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    })

    if (error) {
      console.error('❌ Get user activity error:', error)
      throw error
    }

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get user activity error:', error)
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '사용자 활동 조회 실패'
    }
  }
}
