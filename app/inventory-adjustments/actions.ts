'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { validateDateRange } from '@/lib/date-utils'
import type { 
  AdjustmentSaveRequest,
  AdjustmentProcessResponse,
  InventoryAdjustment,
  AdjustmentFilters,
  AdjustmentSummary,
  AdjustmentCancelRequest,
  AdjustmentCancelResponse
} from '@/types/inventory-adjustment'

/**
 * 재고 조정 저장 (Phase 5: Inventory Adjustment)
 * ✅ 권한: 매니저 이상 (0000~0002)
 * ✅ INCREASE: 신규 레이어 추가
 * ✅ DECREASE: FIFO 차감, 평균 원가 계산
 * ✅ Audit Log: RPC 함수에서 직접 INSERT
 */
export async function saveInventoryAdjustment(data: AdjustmentSaveRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.', adjustment_id: null }
    }

    // 권한: 매니저 이상 (0000~0002)
    if (!['0000', '0001', '0002'].includes(session.role)) {
      return { success: false, message: '재고 조정 권한이 없습니다.', adjustment_id: null }
    }

    const supabase = await createServerClient()

    // 검증: INCREASE 시 unit_cost 필수
    if (data.adjustment_type === 'INCREASE' && (!data.unit_cost || data.unit_cost <= 0)) {
      return {
        success: false,
        message: '재고 증가 시 단위 원가는 필수입니다.',
        adjustment_id: null
      }
    }

    // 검증: 수량 양수
    if (data.quantity <= 0) {
      return {
        success: false,
        message: '수량은 0보다 커야 합니다.',
        adjustment_id: null
      }
    }

    // RPC 호출: process_inventory_adjustment
    const { data: rpcResult, error } = await supabase.rpc('process_inventory_adjustment', {
      p_branch_id: data.branch_id,
      p_product_id: data.product_id,
      p_adjustment_type: data.adjustment_type,
      p_adjustment_reason: data.adjustment_reason,
      p_quantity: data.quantity,
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id,
      p_unit_cost: data.unit_cost || null,
      p_supply_price: data.supply_price || null,
      p_tax_amount: data.tax_amount || null,
      p_total_cost: data.total_cost || null,
      p_notes: data.notes || null,
      p_reference_number: data.reference_number || null,
      p_adjustment_date: data.adjustment_date
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `데이터베이스 오류: ${error.message}`,
        adjustment_id: null
      }
    }

    const result = rpcResult?.[0] as AdjustmentProcessResponse | undefined

    if (!result || !result.success) {
      console.error('❌ 재고 조정 실패:', result?.message)
      return { success: false, message: result?.message || '재고 조정 처리 결과를 받지 못했습니다.', adjustment_id: null }
    }

    // 캐시 무효화
    revalidatePath('/inventory-adjustments')
    revalidatePath('/inventory')

    return result

  } catch (error) {
    console.error('❌ 재고 조정 저장 중 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      adjustment_id: null
    }
  }
}

/**
 * 재고 조정 내역 조회
 * ✅ 권한: 매니저 이상 (0000~0002)
 * ✅ 지점 격리 (시스템 관리자 제외)
 * ✅ 필터링: 날짜, 유형, 사유
 */
export async function getAdjustmentHistory(
  filters?: AdjustmentFilters
): Promise<InventoryAdjustment[]> {
  try {
    const session = await getSession()
    if (!session) return []

    const dateError = validateDateRange(filters?.start_date, filters?.end_date)
    if (dateError) return []

    const supabase = await createServerClient()

    // RPC 호출: get_inventory_adjustments
    const { data, error } = await supabase.rpc('get_inventory_adjustments', {
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id,
      p_start_date: filters?.start_date || null,
      p_end_date: filters?.end_date || null,
      p_adjustment_type: filters?.adjustment_type || null,
      p_adjustment_reason: filters?.adjustment_reason || null
    })

    if (error) {
      console.error('❌ 재고 조정 내역 조회 오류:', {
        error,
        errorType: typeof error,
        errorMessage: error?.message,
        errorDetails: JSON.stringify(error)
      })
      return []
    }

    return (data || []) as InventoryAdjustment[]

  } catch (error) {
    console.error('❌ getAdjustmentHistory 예외:', {
      error,
      errorType: typeof error,
      message: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/**
 * 재고 조정 통계 조회
 * ✅ 권한: 매니저 이상 (0000~0002)
 * ✅ 기간별 집계
 * ✅ 사유별 통계
 */
export async function getAdjustmentSummary(
  start_date: string,
  end_date: string
): Promise<AdjustmentSummary | null> {
  try {
    const session = await getSession()
    if (!session) return null

    const dateError = validateDateRange(start_date, end_date)
    if (dateError) return null

    const supabase = await createServerClient()

    // RPC 호출: get_adjustment_summary
    const { data, error } = await supabase.rpc('get_adjustment_summary', {
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id,
      p_start_date: start_date,
      p_end_date: end_date
    })

    if (error) {
      console.error('❌ 재고 조정 통계 조회 오류:', error)
      throw new Error(`통계 조회 실패: ${error.message}`)
    }

    return data?.[0] as AdjustmentSummary || null

  } catch (error) {
    console.error('❌ getAdjustmentSummary 오류:', error)
    return null
  }
}

/**
 * 재고 조정 취소
 * ✅ 권한: 원장 이상 (0000~0001)
 * ✅ 당일 데이터만 취소 가능 (시스템 관리자 제외)
 * ✅ inventory_layers 복원 (INCREASE: 삭제, DECREASE: FIFO 역순 복원)
 * ✅ Audit Log: RPC 함수에서 직접 INSERT
 */
export async function cancelAdjustment(data: AdjustmentCancelRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    // 권한: 원장 이상 (0000~0001)
    if (!['0000', '0001'].includes(session.role)) {
      return { success: false, message: '재고 조정 취소 권한이 없습니다.' }
    }

    const supabase = await createServerClient()

    // 취소 사유 검증
    if (!data.cancel_reason || data.cancel_reason.trim() === '') {
      return {
        success: false,
        message: '취소 사유를 입력해주세요.'
      }
    }

    // RPC 호출: cancel_inventory_adjustment
    const { data: rpcResult, error } = await supabase.rpc('cancel_inventory_adjustment', {
      p_adjustment_id: data.adjustment_id,
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id,
      p_cancel_reason: data.cancel_reason
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `데이터베이스 오류: ${error.message}`
      }
    }

    const result = rpcResult?.[0] as AdjustmentCancelResponse | undefined

    if (!result || !result.success) {
      console.error('❌ 재고 조정 취소 실패:', result?.message)
      return { success: false, message: result?.message || '재고 조정 취소 결과를 받지 못했습니다.' }
    }

    // 캐시 무효화
    revalidatePath('/inventory-adjustments')
    revalidatePath('/inventory')

    return result

  } catch (error) {
    console.error('❌ 재고 조정 취소 중 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }
  }
}

/**
 * 품목별 현재 재고 조회 (조정 폼에서 참고용)
 * ✅ inventory_layers에서 remaining_quantity 합계
 */
export async function getCurrentStock(
  branch_id: string,
  product_id: string
): Promise<number> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('inventory_layers')
      .select('remaining_quantity')
      .eq('branch_id', branch_id)
      .eq('product_id', product_id)
      .gt('remaining_quantity', 0)

    if (error) {
      console.error('❌ 현재 재고 조회 오류:', error)
      return 0
    }

    const total = data?.reduce((sum, layer) => sum + (layer.remaining_quantity || 0), 0) || 0
    return total

  } catch (error) {
    console.error('❌ getCurrentStock 오류:', error)
    return 0
  }
}

/**
 * 품목 목록 조회 (조정 폼용)
 */
export async function getProductsList() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_products_list')
      .order('code', { ascending: true })

    if (error) {
      console.error('❌ 품목 목록 조회 오류:', error)
      return { success: false, data: [] }
    }

    return { 
      success: true, 
      data: data || [] 
    }
  } catch (error) {
    console.error('❌ getProductsList 오류:', error)
    return { success: false, data: [] }
  }
}
