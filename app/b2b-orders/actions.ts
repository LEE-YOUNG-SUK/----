'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import type {
  B2bOrder,
  B2bOrderDetail,
  B2bOrderFilters,
  B2bCartItem,
  B2bShipment,
  B2bTransactionStatement,
  B2bSettlement,
  B2bSettlementSummary,
  B2bTaxInvoice,
} from '@/types/b2b'

/**
 * 발주 가능 품목 목록 조회 (지점용)
 * - is_b2b_orderable = true 품목만
 * - b2b_price 포함
 */
export async function getOrderableProducts() {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_orderable_products', {
      p_branch_id: session.branch_id
    })

    if (error) {
      return { success: false, data: [], message: `품목 조회 실패: ${error.message}` }
    }

    return { success: true, data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '품목 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * B2B 주문 생성
 * - 권한 검증: RPC 내부에서 b2b_can_user_order 검증
 * - 부가세 자동 계산: RPC 내부에서 처리
 */
export async function createOrder(
  items: { product_id: string; quantity: number; unit_price: number }[],
  memo?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (!items || items.length === 0) {
      return { success: false, message: '주문할 품목이 없습니다.' }
    }

    // 서버 측 유효성 검증
    for (const item of items) {
      if (!item.product_id) {
        return { success: false, message: '품목 ID가 누락되었습니다.' }
      }
      if (!item.quantity || item.quantity <= 0) {
        return { success: false, message: '수량은 0보다 커야 합니다.' }
      }
      if (item.unit_price < 0) {
        return { success: false, message: '단가는 0 이상이어야 합니다.' }
      }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_order', {
      p_user_id: session.user_id,
      p_branch_id: session.branch_id,
      p_items: items as any,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `주문 생성 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '주문 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: `주문이 생성되었습니다. (${result.order_number})`,
      data: { order_id: result.order_id, order_number: result.order_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '주문 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 본사가 지점 대신 주문 생성 (0000 전용)
 */
export async function createOrderForBranch(
  branchId: string,
  items: { product_id: string; quantity: number; unit_price: number }[],
  memo?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 지점 대신 주문할 수 있습니다.' }
    }

    if (!branchId) {
      return { success: false, message: '지점을 선택해주세요.' }
    }

    if (!items || items.length === 0) {
      return { success: false, message: '주문할 품목이 없습니다.' }
    }

    for (const item of items) {
      if (!item.product_id) {
        return { success: false, message: '품목 ID가 누락되었습니다.' }
      }
      if (!item.quantity || item.quantity <= 0) {
        return { success: false, message: '수량은 0보다 커야 합니다.' }
      }
      if (item.unit_price < 0) {
        return { success: false, message: '단가는 0 이상이어야 합니다.' }
      }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_order', {
      p_user_id: session.user_id,
      p_branch_id: branchId,
      p_items: items as any,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `주문 생성 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '주문 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: `주문이 생성되었습니다. (${result.order_number})`,
      data: { order_id: result.order_id, order_number: result.order_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '주문 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문 제출 (draft → pending_approval)
 */
export async function submitOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_submit_order', {
      p_user_id: session.user_id,
      p_order_id: orderId
    })

    if (error) {
      return { success: false, message: `주문 제출 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '주문 제출 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: '주문이 제출되었습니다.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '주문 제출 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 임시저장 주문 취소
 */
export async function cancelDraftOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_cancel_draft_order', {
      p_user_id: session.user_id,
      p_order_id: orderId
    })

    if (error) {
      return { success: false, message: `주문 취소 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '주문 취소 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: '주문이 취소되었습니다.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '주문 취소 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 지점별 주문 목록 조회
 */
export async function getMyOrders(filters?: B2bOrderFilters) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_orders_by_branch', {
      p_branch_id: session.branch_id,
      p_status: filters?.status || null,
      p_from_date: filters?.from_date || null,
      p_to_date: filters?.to_date || null
    })

    if (error) {
      return { success: false, data: [], message: `주문 조회 실패: ${error.message}` }
    }

    return { success: true, data: Array.isArray(data) ? data as B2bOrder[] : [] }
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '주문 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문 상세 조회 (지점용 - 본인 지점 검증)
 */
export async function getOrderDetail(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_order_detail', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: null, message: `주문 상세 조회 실패: ${error.message}` }
    }

    if (!data) {
      return { success: false, data: null, message: '주문을 찾을 수 없습니다.' }
    }

    // RPC returns JSONB with nested structure: { order, branch, ordered_by, items, status_history }
    const result = data as any

    // 지점 사용자는 본인 지점만 조회 가능
    if (session.role !== '0000' && result.order?.branch_id !== session.branch_id) {
      return { success: false, data: null, message: '다른 지점의 주문은 조회할 수 없습니다.' }
    }

    const detail: B2bOrderDetail = {
      order: result.order,
      branch: result.branch,
      ordered_by: result.ordered_by,
      items: Array.isArray(result.items) ? result.items : [],
      status_history: Array.isArray(result.status_history) ? result.status_history : [],
    }

    return { success: true, data: detail }
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '주문 상세 조회 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 3: 수령 확인 + 출고 조회 (지점용)
// =====================================================

/**
 * 수령 확인 (지점 사용자)
 */
export async function confirmReceipt(shipmentId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_confirm_receipt', {
      p_user_id: session.user_id,
      p_shipment_id: shipmentId
    })

    if (error) {
      return { success: false, message: `수령 확인 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '수령 확인 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '수령 확인 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문별 출고 목록 조회 (지점용)
 */
export async function getShipmentsForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_shipments_by_order', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: [], message: `출고 조회 실패: ${error.message}` }
    }

    const shipments: B2bShipment[] = (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      shipment_number: row.shipment_number,
      shipped_at: row.shipped_at,
      courier: row.courier,
      tracking_number: row.tracking_number,
      receipt_confirmed: row.receipt_confirmed,
      receipt_confirmed_at: row.receipt_confirmed_at,
      receipt_confirmed_by: row.receipt_confirmed_by,
      receipt_confirmed_by_name: row.receipt_confirmed_by_name,
      shipped_by: row.shipped_by,
      shipped_by_name: row.shipped_by_name,
      memo: row.memo,
      created_at: row.created_at,
      items: Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json || '[]'),
    }))

    return { success: true, data: shipments }
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '출고 조회 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 4: 거래명세서 조회 (지점용)
// =====================================================

/**
 * 주문별 거래명세서 목록 조회 (지점용 - 발행된 것만)
 */
export async function getStatementsForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bTransactionStatement[], message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_statements_by_order', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: [] as B2bTransactionStatement[], message: `거래명세서 조회 실패: ${error.message}` }
    }

    const statements: B2bTransactionStatement[] = (data || []).map((row: any) => ({
      id: row.id,
      order_id: row.order_id,
      statement_number: row.statement_number,
      status: row.status,
      total_supply_price: row.total_supply_price,
      total_tax_amount: row.total_tax_amount,
      total_price: row.total_price,
      statement_data: row.statement_data,
      memo: row.memo,
      issued_at: row.issued_at,
      issued_by: row.issued_by,
      issued_by_name: row.issued_by_name,
      cancel_reason: row.cancel_reason,
      reissue_count: row.reissue_count,
      reissue_history: row.reissue_history,
      created_at: row.created_at,
      items: Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json || '[]'),
    }))

    return { success: true, data: statements }
  } catch (error) {
    return {
      success: false,
      data: [] as B2bTransactionStatement[],
      message: error instanceof Error ? error.message : '거래명세서 조회 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 5: 정산 조회 (지점용 - 원장만)
// =====================================================

/**
 * 주문별 정산 목록 조회 (지점용)
 */
export async function getSettlementsForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bSettlement[], message: '인증되지 않은 사용자입니다.' }
    }

    // 원장(0001) 이상만 정산 조회 가능
    if (session.role !== '0000' && session.role !== '0001') {
      return { success: true, data: [] as B2bSettlement[] }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_settlements_by_order', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: [] as B2bSettlement[], message: `정산 조회 실패: ${error.message}` }
    }

    const settlements: B2bSettlement[] = (data || []).map((row: any) => ({
      id: row.id,
      settlement_number: row.settlement_number,
      order_id: row.order_id,
      statement_id: row.statement_id,
      direction: row.direction,
      amount: row.amount,
      settlement_date: row.settlement_date,
      method: row.method,
      reference_number: row.reference_number,
      memo: row.memo,
      settled_by: row.settled_by,
      settled_by_name: row.settled_by_name,
      created_at: row.created_at,
    }))

    return { success: true, data: settlements }
  } catch (error) {
    return {
      success: false,
      data: [] as B2bSettlement[],
      message: error instanceof Error ? error.message : '정산 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 정산 요약 조회 (지점용)
 */
export async function getSettlementSummary(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    // 원장(0001) 이상만 정산 요약 조회 가능
    if (session.role !== '0000' && session.role !== '0001') {
      return { success: true, data: null }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_settlement_summary', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: null, message: `정산 요약 조회 실패: ${error.message}` }
    }

    if (!data || data.length === 0) {
      return { success: true, data: null }
    }

    const row = data[0]
    const summary: B2bSettlementSummary = {
      total_price: row.total_price,
      total_settled: row.total_settled,
      remaining: row.remaining,
      settlement_progress: row.settlement_progress,
    }

    return { success: true, data: summary }
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '정산 요약 조회 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 6: 세금계산서 조회 (지점용 - 원장만)
// =====================================================

/**
 * 주문별 세금계산서 조회 (지점용)
 */
export async function getTaxInvoicesForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bTaxInvoice[], message: '인증되지 않은 사용자입니다.' }
    }

    // 원장(0001) 이상만 세금계산서 조회 가능
    if (session.role !== '0000' && session.role !== '0001') {
      return { success: true, data: [] as B2bTaxInvoice[] }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_tax_invoices_by_order', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: [] as B2bTaxInvoice[], message: `세금계산서 조회 실패: ${error.message}` }
    }

    const invoices: B2bTaxInvoice[] = (data || []).map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      order_id: row.order_id,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      status: row.status,
      supply_price: row.supply_price,
      tax_amount: row.tax_amount,
      total_price: row.total_price,
      issue_date: row.issue_date,
      provider_id: row.provider_id,
      requested_at: row.requested_at,
      issued_at: row.issued_at,
      failed_at: row.failed_at,
      failure_reason: row.failure_reason,
      memo: row.memo,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.created_at,
    }))

    return { success: true, data: invoices }
  } catch (error) {
    return {
      success: false,
      data: [] as B2bTaxInvoice[],
      message: error instanceof Error ? error.message : '세금계산서 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 지점 목록 조회 (본사 발주 시 지점 선택용)
 */
export async function getBranchesList() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('branches')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (error) {
      return { success: false, data: [], message: `지점 조회 실패: ${error.message}` }
    }

    return { success: true, data: Array.isArray(data) ? data : [] }
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '지점 조회 중 오류가 발생했습니다.'
    }
  }
}
