'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import type { B2bTaxInvoice, B2bTaxInvoiceStatus } from '@/types/b2b'

/**
 * 세금계산서 생성
 */
export async function createTaxInvoice(orderId: string, memo?: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 세금계산서를 생성할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_create_tax_invoice', {
      p_admin_id: session.user_id,
      p_order_id: orderId,
      p_memo: memo || null
    })

    if (error) {
      return { success: false, message: `세금계산서 생성 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '세금계산서 생성 실패' }
    }

    revalidatePath('/b2b-orders')

    return {
      success: true,
      message: result.message,
      data: { invoice_id: result.invoice_id, invoice_number: result.invoice_number }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '세금계산서 생성 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 세금계산서 상태 변경
 */
export async function updateTaxInvoiceStatus(
  invoiceId: string,
  status: B2bTaxInvoiceStatus,
  providerId?: string,
  failureReason?: string
) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (session.role !== '0000') {
      return { success: false, message: '본사 관리자만 변경할 수 있습니다.' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('b2b_update_tax_invoice_status', {
      p_admin_id: session.user_id,
      p_invoice_id: invoiceId,
      p_status: status,
      p_provider_id: providerId || null,
      p_failure_reason: failureReason || null
    })

    if (error) {
      return { success: false, message: `상태 변경 실패: ${error.message}` }
    }

    const result = data?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '상태 변경 실패' }
    }

    revalidatePath('/b2b-orders')

    return { success: true, message: result.message }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 주문별 세금계산서 조회
 */
export async function getTaxInvoicesForOrder(orderId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, data: [] as B2bTaxInvoice[], message: '인증되지 않은 사용자입니다.' }
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
