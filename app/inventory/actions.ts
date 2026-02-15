'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
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
 * DB 레벨에서 reference_number 필터링
 */
export async function getPurchasesByReferenceNumber(referenceNumber: string, branchId: string | null) {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [] as PurchaseHistory[], message: '로그인이 필요합니다.' }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : branchId

    const supabase = await createServerClient()

    let query = supabase
      .from('purchases')
      .select(`
        id, branch_id, client_id, product_id, quantity, unit_cost, purchase_date,
        reference_number, notes, created_at, created_by, updated_by, updated_at,
        tax_amount, supply_price, total_price,
        branches!inner(name),
        clients(name),
        products!inner(code, name, unit),
        creator:users!purchases_created_by_fkey(display_name, username),
        updater:users!purchases_updated_by_fkey(display_name, username)
      `)
      .eq('reference_number', referenceNumber)

    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId)
    }

    const { data, error } = await query.order('purchase_date', { ascending: false })

    if (error) {
      return { success: false, data: [] as PurchaseHistory[], message: error.message }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: PurchaseHistory[] = (data || []).map((row: any) => ({
      id: row.id,
      branch_id: row.branch_id,
      branch_name: row.branches?.name || '',
      client_id: row.client_id,
      client_name: row.clients?.name || '',
      product_id: row.product_id,
      product_code: row.products?.code || '',
      product_name: row.products?.name || '',
      unit: row.products?.unit || '',
      purchase_date: row.purchase_date,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      total_price: row.total_price,
      supply_price: row.supply_price,
      tax_amount: row.tax_amount,
      reference_number: row.reference_number || '',
      notes: row.notes || '',
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_name: row.creator?.display_name || row.creator?.username || '알 수 없음',
      updated_by: row.updated_by,
      updated_by_name: row.updater?.display_name || row.updater?.username || null,
      updated_at: row.updated_at,
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('getPurchasesByReferenceNumber:', error)
    return { success: false, data: [] as PurchaseHistory[], message: '입고 내역 조회 실패' }
  }
}

/**
 * 거래번호로 판매 내역 조회 (수정 모달용)
 * DB 레벨에서 reference_number 필터링
 */
export async function getSalesByReferenceNumber(referenceNumber: string, branchId: string | null) {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [] as SaleHistory[], message: '로그인이 필요합니다.' }

    const effectiveBranchId = ['0001', '0002', '0003'].includes(session.role)
      ? session.branch_id
      : branchId

    const supabase = await createServerClient()

    let query = supabase
      .from('sales')
      .select(`
        id, branch_id, client_id, product_id, quantity, unit_price, sale_date,
        reference_number, notes, created_at, created_by, updated_by, updated_at,
        tax_amount, supply_price, total_price, cost_of_goods_sold, profit, transaction_type,
        branches!inner(name),
        clients(name),
        products!inner(code, name, unit),
        creator:users!sales_created_by_fkey(display_name, username),
        updater:users!sales_updated_by_fkey(display_name, username)
      `)
      .eq('reference_number', referenceNumber)

    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId)
    }

    const { data, error } = await query.order('sale_date', { ascending: false })

    if (error) {
      return { success: false, data: [] as SaleHistory[], message: error.message }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: SaleHistory[] = (data || []).map((row: any) => ({
      id: row.id,
      branch_id: row.branch_id,
      client_id: row.client_id,
      product_id: row.product_id,
      sale_date: row.sale_date,
      branch_name: row.branches?.name || '',
      customer_name: row.clients?.name || '',
      product_code: row.products?.code || '',
      product_name: row.products?.name || '',
      unit: row.products?.unit || '',
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_price: row.total_price,
      cost_of_goods_sold: row.cost_of_goods_sold || 0,
      profit: row.profit || 0,
      profit_margin: row.total_price > 0 ? ((row.profit || 0) / row.total_price) * 100 : 0,
      supply_price: row.supply_price,
      tax_amount: row.tax_amount,
      reference_number: row.reference_number || '',
      notes: row.notes || '',
      created_by_name: row.creator?.display_name || row.creator?.username || '알 수 없음',
      created_at: row.created_at,
      transaction_type: row.transaction_type || 'SALE',
      updated_by: row.updated_by,
      updated_by_name: row.updater?.display_name || row.updater?.username || null,
      updated_at: row.updated_at,
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('getSalesByReferenceNumber:', error)
    return { success: false, data: [] as SaleHistory[], message: '판매 내역 조회 실패' }
  }
}
