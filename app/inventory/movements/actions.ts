'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { InventoryMovement } from '@/types/inventory'
import { validateDateRange } from '@/lib/date-utils'

// ============================================
// 재고수불부 - 품목별 입출고/재고잔량 조회
// ============================================

export interface MovementHistoryFilter {
  branchId: string | null
  productId: string
  startDate: string
  endDate: string
}

export async function getMovementHistory(filter: MovementHistoryFilter) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as InventoryMovement[], message: '로그인이 필요합니다.' }
    }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [] as InventoryMovement[], message: dateError }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : (filter.branchId || null)

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_inventory_movement_history', {
      p_branch_id: effectiveBranchId,
      p_product_id: filter.productId,
      p_start_date: filter.startDate,
      p_end_date: filter.endDate,
    })

    if (error) {
      console.error('재고수불부 조회 오류:', error)
      return { success: false, data: [] as InventoryMovement[], message: error.message }
    }

    return {
      success: true,
      data: (data || []) as InventoryMovement[],
    }
  } catch (error) {
    console.error('getMovementHistory 오류:', error)
    return {
      success: false,
      data: [] as InventoryMovement[],
      message: error instanceof Error ? error.message : '재고수불부 조회 실패'
    }
  }
}

export async function getBranches() {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [] as { id: string; name: string; code: string }[] }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    if (error) return { success: false, data: [] as { id: string; name: string; code: string }[] }
    return { success: true, data: (data || []) as { id: string; name: string; code: string }[] }
  } catch {
    return { success: false, data: [] as { id: string; name: string; code: string }[] }
  }
}
