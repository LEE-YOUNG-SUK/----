'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { validateDateRange } from '@/lib/date-utils'
import type { InventoryStatusItem } from '@/types/inventory'

export interface InventoryStatusFilter {
  branchId: string | null
  productId: string | null
  startDate: string
  endDate: string
}

export async function getInventoryStatus(filter: InventoryStatusFilter) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as InventoryStatusItem[], message: '로그인이 필요합니다.' }
    }

    // 역할 기반 지점 필터링: 원장/매니저/사용자는 본인 지점만
    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : (filter.branchId || null)

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_inventory_status', {
      p_branch_id: effectiveBranchId,
      p_product_id: filter.productId || null,
      p_end_date: filter.endDate,
    })

    if (error) {
      console.error('재고 현황 조회 오류:', error)
      return { success: false, data: [] as InventoryStatusItem[], message: error.message }
    }

    return {
      success: true,
      data: (data || []) as InventoryStatusItem[],
    }
  } catch (error) {
    console.error('getInventoryStatus 오류:', error)
    return {
      success: false,
      data: [] as InventoryStatusItem[],
      message: error instanceof Error ? error.message : '재고 현황 조회 실패'
    }
  }
}

/**
 * 활성 지점 목록 조회
 */
export async function getBranchesList() {
  try {
    const session = await getSession()
    if (!session) return []

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('지점 목록 조회 오류:', error)
      return []
    }
    return data || []
  } catch {
    return []
  }
}
