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
  productIds: string[]
  startDate: string
  endDate: string
}

export interface ProductMovementGroup {
  productId: string
  productCode: string
  productName: string
  unit: string
  movements: InventoryMovement[]
}

export async function getMovementHistory(filter: MovementHistoryFilter) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as ProductMovementGroup[], message: '로그인이 필요합니다.' }
    }

    if (filter.productIds.length === 0) {
      return { success: false, data: [] as ProductMovementGroup[], message: '품목을 선택하세요.' }
    }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [] as ProductMovementGroup[], message: dateError }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : (filter.branchId || null)

    const supabase = await createServerClient()

    // 품목별 병렬 조회
    const results = await Promise.all(
      filter.productIds.map(async (productId) => {
        const { data, error } = await supabase.rpc('get_inventory_movement_history', {
          p_branch_id: effectiveBranchId,
          p_product_id: productId,
          p_start_date: filter.startDate,
          p_end_date: filter.endDate,
        })
        return { productId, data, error }
      })
    )

    // 에러 체크
    const firstError = results.find(r => r.error)
    if (firstError?.error) {
      console.error('재고수불부 조회 오류:', firstError.error)
      return { success: false, data: [] as ProductMovementGroup[], message: firstError.error.message }
    }

    // 품목 정보 조회
    const { data: productData } = await supabase
      .from('products')
      .select('id, code, name, unit')
      .in('id', filter.productIds)

    const productMap = new Map(
      (productData || []).map(p => [p.id, p])
    )

    // 품목별 그룹 생성
    const groups: ProductMovementGroup[] = filter.productIds.map(productId => {
      const product = productMap.get(productId)
      const result = results.find(r => r.productId === productId)
      return {
        productId,
        productCode: product?.code || '',
        productName: product?.name || '',
        unit: product?.unit || '',
        movements: (result?.data || []) as InventoryMovement[],
      }
    })

    return {
      success: true,
      data: groups,
    }
  } catch (error) {
    console.error('getMovementHistory 오류:', error)
    return {
      success: false,
      data: [] as ProductMovementGroup[],
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
