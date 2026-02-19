'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

interface ImportPurchaseData {
  branch_id: string
  client_id: string | null
  purchase_date: string
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
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    // 권한 체크: 시스템 관리자 또는 원장만 허용
    if (!['0000', '0001'].includes(session.role)) {
      return { success: false, message: '데이터 가져오기 권한이 없습니다.' }
    }

    // 지점 격리: 관리자만 타 지점 import 가능
    if (session.role !== '0000' && data.branch_id !== session.branch_id) {
      return { success: false, message: '다른 지점의 데이터는 등록할 수 없습니다.' }
    }

    if (!data.branch_id || !data.purchase_date || data.items.length === 0) {
      return { success: false, message: '필수 데이터가 누락되었습니다.' }
    }

    const supabase = await createServerClient()

    const itemsJson = data.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_cost),
      notes: item.notes || ''
    }))

    const { data: rpcData, error } = await supabase.rpc('process_batch_purchase', {
      p_branch_id: data.branch_id,
      p_client_id: data.client_id,
      p_purchase_date: data.purchase_date,
      p_reference_number: null,
      p_notes: '',
      p_created_by: session.user_id,
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
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    // 권한 체크: 시스템 관리자 또는 원장만 허용
    if (!['0000', '0001'].includes(session.role)) {
      return { success: false, message: '데이터 가져오기 권한이 없습니다.' }
    }

    // 지점 격리: 관리자만 타 지점 import 가능
    if (session.role !== '0000' && data.branch_id !== session.branch_id) {
      return { success: false, message: '다른 지점의 데이터는 등록할 수 없습니다.' }
    }

    if (!data.branch_id || !data.sale_date || data.items.length === 0) {
      return { success: false, message: '필수 데이터가 누락되었습니다.' }
    }

    const supabase = await createServerClient()

    const itemsJson = data.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_price),
      notes: item.notes || ''
    }))

    const { data: rpcData, error } = await supabase.rpc('process_batch_sale', {
      p_branch_id: data.branch_id,
      p_client_id: data.client_id,
      p_sale_date: data.sale_date,
      p_reference_number: null,
      p_notes: '',
      p_created_by: session.user_id,
      p_items: itemsJson as any,
      p_transaction_type: 'SALE'
    })

    if (error) {
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
        .rpc('get_products_list', { p_branch_id: null })
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
  } catch {
    return { branches: [], products: [], clients: [] }
  }
}
