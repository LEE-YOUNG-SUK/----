// app/sales/actions.ts
'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { SaleFormData, SaleHistory } from '@/types/sales'

/**
 * 판매 데이터 일괄 저장
 * FIFO 원가 자동 계산 포함
 */
export async function saveSales(data: SaleFormData) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    
    if (!sessionToken) {
      return { success: false, error: '인증 정보가 없습니다' }
    }

    const supabase = await createServerClient()

    // 세션 검증
    const { data: session } = await supabase.rpc('verify_session', {
      p_token: sessionToken
    })

    if (!session) {
      return { success: false, error: '유효하지 않은 세션입니다' }
    }

    // 컨텍스트 설정
    await supabase.rpc('set_current_user_context', {
      p_user_id: session.user_id,
      p_role: session.role,
      p_branch_id: session.branch_id
    })

    // 각 판매 항목 처리
    const results = []
    for (const item of data.items) {
      const { data: result, error } = await supabase.rpc('process_sale_with_fifo', {
        p_branch_id: data.branch_id,
        p_client_id: data.customer_id,
        p_product_id: item.id,
        p_quantity: item.quantity,
        p_unit_price: item.unit_price,
        p_sale_date: data.sale_date,
        p_created_by: session.user_id,
        p_reference_number: data.reference_number || null,
        p_notes: data.notes || null
      })

      if (error) {
        console.error('판매 처리 오류:', error)
        return { 
          success: false, 
          error: `${item.product_name} 판매 실패: ${error.message}` 
        }
      }

      results.push(result)
    }

    return { 
      success: true, 
      message: `${data.items.length}건의 판매가 저장되었습니다`,
      results 
    }
  } catch (error) {
    console.error('saveSales 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    }
  }
}

/**
 * 재고가 있는 품목 목록 조회
 */
export async function getProductsWithStock(branchId: string) {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('current_inventory')
      .select(`
        product_id,
        current_quantity,
        products!inner (
          id,
          code,
          name,
          specification,
          manufacturer,
          unit,
          standard_sale_price
        )
      `)
      .eq('branch_id', branchId)
      .gt('current_quantity', 0)

    if (error) throw error

    // Supabase는 any 타입으로 반환하므로 타입 단언 사용
    const mappedData = (data || []).map((item: any) => ({
      id: item.products.id,
      code: item.products.code,
      name: item.products.name,
      specification: item.products.specification || '',
      manufacturer: item.products.manufacturer || '',
      unit: item.products.unit,
      standard_sale_price: item.products.standard_sale_price || 0,
      current_stock: item.current_quantity
    }))

    return {
      success: true,
      data: mappedData
    }
  } catch (error) {
    console.error('품목 조회 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '품목 조회 실패',
      data: [] 
    }
  }
}

/**
 * 고객(거래처) 목록 조회
 */
export async function getCustomersList() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_customers_list')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('고객 목록 조회 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '고객 목록 조회 실패',
      data: [] 
    }
  }
}

/**
 * 판매 내역 조회
 */
export async function getSalesHistory(
  branchId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_sales_list', {
      p_branch_id: branchId,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    })

    if (error) throw error

    // 이익률 계산 추가
    const historyWithRate: SaleHistory[] = (data || []).map((item: {
      id: string
      sale_date: string
      customer_name: string
      product_name: string
      quantity: number
      unit_price: number
      total_amount: number
      cost_of_goods: number
      profit: number
      reference_number?: string
      notes?: string
      created_by_name: string
      created_at: string
    }) => ({
      ...item,
      profit_rate: item.total_amount > 0 
        ? ((item.profit / item.total_amount) * 100).toFixed(1)
        : '0'
    }))

    return { success: true, data: historyWithRate }
  } catch (error) {
    console.error('판매 내역 조회 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '판매 내역 조회 실패',
      data: [] 
    }
  }
}

/**
 * 지점 목록 조회 (시스템 관리자용)
 */
export async function getBranchesList() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('branches')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('지점 목록 조회 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '지점 목록 조회 실패',
      data: [] 
    }
  }
}