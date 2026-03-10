'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import type {
  B2bOrder,
  B2bOrderDetail,
  B2bOrderFilters,
  B2bShipment,
  B2bShipmentItem,
  B2bTransactionStatement,
  B2bStatementItem,
  B2bSettlement,
  B2bSettlementSummary,
} from '@/types/b2b'

/**
 * 전체 주문 목록 조회 (본사용)
 */
export async function getAllOrders(filters?: B2bOrderFilters) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, data: [], message: '본사 관리자만 접근할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_all_orders', {
      p_status: filters?.status || null,
      p_branch_id: filters?.branch_id || null,
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
 * 주문 상세 조회 (본사용 - 모든 주문 조회 가능)
 */
export async function getAdminOrderDetail(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, data: null, message: '본사 관리자만 접근할 수 있습니다.' }
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

/**
 * 품목 B2B 발주 가능 토글 (본사 0000 전용)
 */
export async function toggleProductOrderable(productId: string, isOrderable: boolean) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 설정할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_toggle_product_orderable', {
      p_user_id: session.user_id,
      p_product_id: productId,
      p_is_orderable: isOrderable
    })

    if (error) {
      return { success: false, message: `설정 변경 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '설정 변경 실패' }
    }

    revalidatePath('/products')
    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '설정 변경 중 오류가 발생했습니다.'
    }
  }
}

/**
 * B2B 전용단가 설정 (본사 0000 전용)
 */
export async function updateProductB2bPrice(productId: string, price: number) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 설정할 수 있습니다.' }
    }

    if (price < 0) {
      return { success: false, message: '단가는 0 이상이어야 합니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_update_product_b2b_price', {
      p_user_id: session.user_id,
      p_product_id: productId,
      p_price: price
    })

    if (error) {
      return { success: false, message: `단가 설정 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '단가 설정 실패' }
    }

    revalidatePath('/products')
    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '단가 설정 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 매니저 B2B 발주 권한 토글 (원장 전용)
 */
export async function toggleManagerOrderPermission(targetUserId: string, canOrder: boolean) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    // 원장(0001) 또는 시스템 관리자(0000)만 가능
    if (session.role !== '0000' && session.role !== '0001') {
      return { success: false, message: '원장 이상만 설정할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_toggle_manager_order_permission', {
      p_director_id: session.user_id,
      p_target_user_id: targetUserId,
      p_can_order: canOrder
    })

    if (error) {
      return { success: false, message: `권한 변경 실패: ${error.message}` }
    }

    // RPC returns JSONB object directly
    const result = data as any
    if (!result || !result.success) {
      return { success: false, message: result?.message || '권한 변경 실패' }
    }

    revalidatePath('/admin/users')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '권한 변경 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 3: 주문 처리 서버 액션
// =====================================================

/**
 * 주문 승인 (pending_approval → approved)
 */
export async function approveOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 승인할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_approve_order', {
      p_admin_id: session.user_id,
      p_order_id: orderId
    })

    if (error) {
      return { success: false, message: `승인 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '승인 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '승인 처리 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문 보류 (→ on_hold)
 */
export async function holdOrder(orderId: string, reason: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 보류 처리할 수 있습니다.' }
    }

    if (!reason || !reason.trim()) {
      return { success: false, message: '보류 사유를 입력해주세요.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_hold_order', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_reason: reason
    })

    if (error) {
      return { success: false, message: `보류 처리 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '보류 처리 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '보류 처리 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 보류 해제 (on_hold → approved)
 */
export async function resumeOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 보류 해제할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_resume_order', {
      p_admin_id: session.user_id,
      p_order_id: orderId
    })

    if (error) {
      return { success: false, message: `보류 해제 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '보류 해제 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '보류 해제 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문 취소 (출고 전 상태만)
 */
export async function cancelOrder(orderId: string, reason: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 취소할 수 있습니다.' }
    }

    if (!reason || !reason.trim()) {
      return { success: false, message: '취소 사유를 입력해주세요.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_cancel_order', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_reason: reason
    })

    if (error) {
      return { success: false, message: `취소 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '취소 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '취소 처리 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 3: 출고 서버 액션
// =====================================================

/**
 * 출고 생성 (부분출고 지원)
 */
export async function createShipment(
  orderId: string,
  items: { order_item_id: string; quantity: number }[],
  courier?: string,
  trackingNumber?: string,
  memo?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 출고 처리할 수 있습니다.' }
    }

    if (!items || items.length === 0) {
      return { success: false, message: '출고할 항목이 없습니다.' }
    }

    // 수량 0인 항목 제외
    const validItems = items.filter(i => i.quantity > 0)
    if (validItems.length === 0) {
      return { success: false, message: '출고할 수량이 없습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_shipment', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_items: validItems as any,
      p_courier: courier || null,
      p_tracking_number: trackingNumber || null,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `출고 생성 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '출고 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: result.message,
      data: { shipment_id: result.shipment_id, shipment_number: result.shipment_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '출고 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문별 출고 목록 조회
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

    // RPC 결과를 B2bShipment[] 형태로 변환
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
// Phase 4: 거래명세서 서버 액션
// =====================================================

/**
 * 거래명세서 초안 생성
 */
export async function createStatement(
  orderId: string,
  items: { order_item_id: string; quantity: number }[],
  memo?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 거래명세서를 생성할 수 있습니다.' }
    }

    if (!items || items.length === 0) {
      return { success: false, message: '명세서 항목이 없습니다.' }
    }

    const validItems = items.filter(i => i.quantity > 0)
    if (validItems.length === 0) {
      return { success: false, message: '수량이 입력된 항목이 없습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_statement', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_items: validItems as any,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `거래명세서 생성 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '거래명세서 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: result.message,
      data: { statement_id: result.statement_id, statement_number: result.statement_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '거래명세서 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 거래명세서 발행 (draft → issued)
 */
export async function issueStatement(statementId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 발행할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_issue_statement', {
      p_admin_id: session.user_id,
      p_statement_id: statementId
    })

    if (error) {
      return { success: false, message: `발행 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '발행 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '발행 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 거래명세서 취소
 */
export async function cancelStatement(statementId: string, reason?: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 취소할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_cancel_statement', {
      p_admin_id: session.user_id,
      p_statement_id: statementId,
      p_reason: reason || null
    })

    if (error) {
      return { success: false, message: `취소 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '취소 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '취소 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 거래명세서 재발행
 */
export async function reissueStatement(statementId: string, reason?: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 재발행할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_reissue_statement', {
      p_admin_id: session.user_id,
      p_statement_id: statementId,
      p_reason: reason || null
    })

    if (error) {
      return { success: false, message: `재발행 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '재발행 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '재발행 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문별 거래명세서 목록 조회
 */
export async function getStatementsForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [], message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_statements_by_order', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: [], message: `거래명세서 조회 실패: ${error.message}` }
    }

    const statements: B2bTransactionStatement[] = (data || []).map((row: any) => ({
      id: row.id,
      statement_number: row.statement_number,
      order_id: row.order_id,
      status: row.status,
      issued_at: row.issued_at,
      issued_by: row.issued_by,
      issued_by_name: row.issued_by_name,
      total_supply_price: row.total_supply_price,
      total_tax_amount: row.total_tax_amount,
      total_price: row.total_price,
      statement_data: null,
      reissue_count: row.reissue_count,
      reissue_history: [],
      canceled_at: row.canceled_at,
      canceled_by: null,
      cancel_reason: row.cancel_reason,
      memo: row.memo,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.created_at,
      items: Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json || '[]'),
    }))

    return { success: true, data: statements }
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '거래명세서 조회 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 거래명세서 상세 조회 (인쇄용 statement_data 포함)
 */
export async function getStatementDetail(statementId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_statement_detail', {
      p_statement_id: statementId
    })

    if (error) {
      return { success: false, data: null, message: `상세 조회 실패: ${error.message}` }
    }

    if (!data || data.length === 0) {
      return { success: false, data: null, message: '거래명세서를 찾을 수 없습니다.' }
    }

    const row = data[0]
    const statement: B2bTransactionStatement = {
      id: row.id,
      statement_number: row.statement_number,
      order_id: row.order_id,
      order_number: row.order_number,
      status: row.status,
      issued_at: row.issued_at,
      issued_by: row.issued_by,
      issued_by_name: row.issued_by_name,
      total_supply_price: row.total_supply_price,
      total_tax_amount: row.total_tax_amount,
      total_price: row.total_price,
      statement_data: row.statement_data,
      reissue_count: row.reissue_count,
      reissue_history: Array.isArray(row.reissue_history) ? row.reissue_history : JSON.parse(row.reissue_history || '[]'),
      canceled_at: row.canceled_at,
      canceled_by: row.canceled_by,
      cancel_reason: row.cancel_reason,
      memo: row.memo,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.created_at,
      items: Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json || '[]'),
    }

    return { success: true, data: statement }
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : '상세 조회 중 오류가 발생했습니다.'
    }
  }
}

// =====================================================
// Phase 5: 정산 서버 액션
// =====================================================

/**
 * 정산 생성
 */
export async function createSettlement(
  orderId: string,
  amount: number,
  direction: 'receivable' | 'payable',
  method?: string,
  referenceNumber?: string,
  statementId?: string,
  memo?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 정산을 처리할 수 있습니다.' }
    }

    if (!amount || amount <= 0) {
      return { success: false, message: '정산 금액은 0보다 커야 합니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_settlement', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_amount: amount,
      p_direction: direction,
      p_method: method || null,
      p_reference_number: referenceNumber || null,
      p_statement_id: statementId || null,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `정산 생성 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '정산 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: result.message,
      data: { settlement_id: result.settlement_id, settlement_number: result.settlement_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '정산 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문별 정산 목록 조회
 */
export async function getSettlementsForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bSettlement[], message: '인증되지 않은 사용자입니다.' }
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
 * 정산 요약 조회
 */
export async function getSettlementSummary(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: null, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_get_settlement_summary', {
      p_order_id: orderId
    })

    if (error) {
      return { success: false, data: null, message: `정산 요약 조회 실패: ${error.message}` }
    }

    if (!data || data.length === 0) {
      return { success: false, data: null, message: '주문을 찾을 수 없습니다.' }
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

/**
 * 주문 완료 처리 (settled → completed)
 */
export async function completeOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 주문을 완료할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_complete_order', {
      p_admin_id: session.user_id,
      p_order_id: orderId
    })

    if (error) {
      return { success: false, message: `주문 완료 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '주문 완료 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '주문 완료 처리 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 지점 목록 조회 (필터용)
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
