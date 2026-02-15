'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

interface ImportPurchaseData {
  branch_id: string
  client_id: string | null
  purchase_date: string
  created_by: string
  items: {
    product_id: string
    quantity: number
    unit_cost: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }[]
}

interface ImportSaleData {
  branch_id: string
  client_id: string | null
  sale_date: string
  created_by: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
    supply_price: number
    tax_amount: number
    total_price: number
    notes: string
  }[]
}

export async function importPurchases(data: ImportPurchaseData) {
  try {
    const supabase = await createServerClient()

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    if (!sessionCookie) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (!data.branch_id || !data.purchase_date || data.items.length === 0) {
      return { success: false, message: '필수 데이터가 누락되었습니다.' }
    }

    const itemsJson = data.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_cost),
      notes: item.notes || ''
    }))

    // Audit context
    await supabase.rpc('set_current_user_context', {
      p_user_id: data.created_by
    })

    const { data: rpcData, error } = await supabase.rpc('process_batch_purchase', {
      p_branch_id: data.branch_id,
      p_client_id: data.client_id,
      p_purchase_date: data.purchase_date,
      p_reference_number: null,
      p_notes: '',
      p_created_by: data.created_by,
      p_items: itemsJson as any
    })

    if (error) {
      return { success: false, message: `입고 등록 실패: ${error.message}` }
    }

    const result = rpcData?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '입고 등록 실패' }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')

    return {
      success: true,
      message: `${result.total_items}개 품목 입고 완료 (${result.transaction_number})`,
      data: result
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '입고 등록 중 오류 발생'
    }
  }
}

export async function importSales(data: ImportSaleData) {
  try {
    const supabase = await createServerClient()

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    if (!sessionCookie) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (!data.branch_id || !data.sale_date || data.items.length === 0) {
      return { success: false, message: '필수 데이터가 누락되었습니다.' }
    }

    const itemsJson = data.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_price),
      notes: item.notes || ''
    }))

    // Audit context
    await supabase.rpc('set_current_user_context', {
      p_user_id: data.created_by
    })

    const { data: rpcData, error } = await supabase.rpc('process_batch_sale', {
      p_branch_id: data.branch_id,
      p_client_id: data.client_id,
      p_sale_date: data.sale_date,
      p_reference_number: null,
      p_notes: '',
      p_created_by: data.created_by,
      p_items: itemsJson as any,
      p_transaction_type: 'SALE'
    })

    if (error) {
      console.error('Import sale RPC error:', error)
      return { success: false, message: `판매 등록 실패: ${error.message}` }
    }

    const result = rpcData?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '판매 등록 실패' }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')

    return {
      success: true,
      message: `${result.total_items}개 품목 판매 완료 (${result.transaction_number})`,
      data: result
    }
  } catch (error) {
    console.error('Import sales error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '판매 등록 중 오류 발생'
    }
  }
}

export async function getImportData() {
  try {
    const supabase = await createServerClient()

    const [branchesRes, productsRes, clientsRes] = await Promise.all([
      supabase
        .from('branches')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code'),
      supabase
        .rpc('get_products_list')
        .order('code'),
      supabase
        .rpc('get_clients_list')
        .order('code')
    ])

    return {
      branches: branchesRes.data || [],
      products: productsRes.data || [],
      clients: clientsRes.data || []
    }
  } catch (error) {
    console.error('Get import data error:', error)
    return { branches: [], products: [], clients: [] }
  }
}
