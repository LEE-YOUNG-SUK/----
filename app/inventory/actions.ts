'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { validateDateRange } from '@/lib/date-utils'
import type { InventoryStatusItem } from '@/types/inventory'
import type { PurchaseHistory } from '@/types/purchases'
import type { SaleHistory } from '@/types/sales'

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

/**
 * 거래번호로 입고 내역 조회 (수정 모달용)
 */
export async function getPurchasesByReferenceNumber(referenceNumber: string, branchId: string | null) {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [] as PurchaseHistory[], message: '로그인이 필요합니다.' }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : branchId

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('get_purchases_list', {
      p_branch_id: effectiveBranchId,
      p_start_date: null,
      p_end_date: null
    })

    if (error) {
      console.error('입고 내역 조회 오류:', error)
      return { success: false, data: [] as PurchaseHistory[], message: error.message }
    }

    const filtered = (data || []).filter((item: PurchaseHistory) => item.reference_number === referenceNumber)
    return { success: true, data: filtered as PurchaseHistory[] }
  } catch (error) {
    console.error('getPurchasesByReferenceNumber 오류:', error)
    return { success: false, data: [] as PurchaseHistory[], message: '입고 내역 조회 실패' }
  }
}

/**
 * 거래번호로 판매 내역 조회 (수정 모달용)
 */
export async function getSalesByReferenceNumber(referenceNumber: string, branchId: string | null) {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [] as SaleHistory[], message: '로그인이 필요합니다.' }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : branchId

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('get_sales_list', {
      p_branch_id: effectiveBranchId,
      p_start_date: null,
      p_end_date: null
    })

    if (error) {
      console.error('판매 내역 조회 오류:', error)
      return { success: false, data: [] as SaleHistory[], message: error.message }
    }

    const filtered = (data || []).filter((item: SaleHistory) => item.reference_number === referenceNumber)
    return { success: true, data: filtered as SaleHistory[] }
  } catch (error) {
    console.error('getSalesByReferenceNumber 오류:', error)
    return { success: false, data: [] as SaleHistory[], message: '판매 내역 조회 실패' }
  }
}
