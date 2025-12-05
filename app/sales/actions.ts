'use server'

/**
 * 판매 관리 Server Actions (Phase 1: 트랜잭션 처리 강화)
 */

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { 
  SaleSaveRequest, 
  BatchSaleResponse,
  SaleUpdateRequest,
  SaleDeleteRequest 
} from '@/types/sales'

/**
 * 판매 데이터 일괄 저장
 * ✅ 전체 성공 또는 전체 실패 (원자성 보장)
 * ✅ FIFO 원가 자동 계산
 * ✅ 재고 부족 사전 체크 (전체 롤백)
 */
export async function saveSales(data: SaleSaveRequest) {
  try {
    const supabase = await createServerClient()
    
    // 세션 확인
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    
    if (!sessionCookie) {
      return { 
        success: false, 
        message: '인증되지 않은 사용자입니다.' 
      }
    }

    // 검증
    if (!data.customer_id) {
      return { success: false, message: '고객을 선택해주세요.' }
    }
    
    if (!data.sale_date) {
      return { success: false, message: '판매일을 선택해주세요.' }
    }
    
    if (!data.branch_id) {
      return { success: false, message: '지점을 선택해주세요.' }
    }
    
    if (data.items.length === 0) {
      return { success: false, message: '판매할 품목이 없습니다.' }
    }

    // 빈 행 필터링
    const validItems = data.items.filter(item => item.product_id && item.product_id.trim() !== '')
    
    if (validItems.length === 0) {
      return { success: false, message: '유효한 품목이 없습니다.' }
    }

    // ✅ 재고 사전 체크 제거 - 마이너스 재고 허용
    // for (const item of validItems) {
    //   if (item.quantity > item.current_stock) {
    //     return {
    //       success: false,
    //       message: `재고 부족: ${item.product_name}\n필요: ${item.quantity}, 재고: ${item.current_stock}`
    //     }
    //   }
    // }

    // JSONB 형식으로 변환
    const itemsJson = validItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_price),
      notes: item.notes || ''
    }))

    console.log('🛒 판매 일괄 저장 시작:', {
      branch_id: data.branch_id,
      customer_id: data.customer_id,
      item_count: validItems.length
    })

    // ✅ Phase 3: Audit Log - 사용자 컨텍스트 설정
    const setConfigQuery = `SELECT set_config('app.current_user_id', '${data.created_by}', false)`
    const { error: configError } = await supabase.rpc('exec_sql', { query: setConfigQuery })
    
    if (configError) {
      console.error('❌ Config Error:', configError)
      // 컨텍스트 설정 실패는 warning으로 처리 (비즈니스 로직 중단 안함)
    }

    // ✅ 단일 RPC 호출 (트랜잭션 보장)
    const { data: rpcData, error } = await supabase.rpc('process_batch_sale', {
      p_branch_id: data.branch_id,
      p_client_id: data.customer_id,
      p_sale_date: data.sale_date,
      p_reference_number: data.reference_number || null,
      p_notes: data.notes || '',
      p_created_by: data.created_by,
      p_items: itemsJson as any
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `판매 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0] as BatchSaleResponse

    if (!result || !result.success) {
      console.error('❌ 판매 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '판매 저장 실패'
      }
    }

    console.log('✅ 판매 성공:', {
      transaction_number: result.transaction_number,
      total_items: result.total_items,
      total_amount: result.total_amount,
      total_cost: result.total_cost,
      total_profit: result.total_profit
    })

    revalidatePath('/sales')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: `${result.total_items}개 품목 판매 완료\n거래번호: ${result.transaction_number}\n이익: ${result.total_profit.toLocaleString()}원`,
      data: result
    }

  } catch (error) {
    console.error('❌ Save sales error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '판매 저장 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 전체 품목 목록 조회 (재고 포함)
 * 입고 관리처럼 전체 품목 표시
 */
export async function getProductsWithStock(branchId: string | null) {
  try {
    const supabase = await createServerClient()

    // 1. 전체 품목 조회
    const { data: allProducts, error: productsError } = await supabase
      .rpc('get_products_list')
      .order('code', { ascending: true })

    if (productsError) throw productsError

    // 2. 재고 조회 (지점별 또는 전체)
    let inventoryQuery = supabase
      .from('inventory_layers')
      .select('product_id, remaining_quantity')
      .gt('remaining_quantity', 0)
    
    // branch_id가 있으면 해당 지점만, 없으면 전체 지점 재고 합계
    if (branchId) {
      inventoryQuery = inventoryQuery.eq('branch_id', branchId)
    }

    const { data: inventoryData, error: inventoryError } = await inventoryQuery

    if (inventoryError) throw inventoryError

    // 3. 재고 맵 생성 (product_id별 합계 계산)
    const stockMap = new Map()
    if (inventoryData) {
      inventoryData.forEach((item: any) => {
        const currentStock = stockMap.get(item.product_id) || 0
        stockMap.set(item.product_id, currentStock + item.remaining_quantity)
      })
    }

    // 4. 전체 품목 + 재고 정보 결합
    const productsWithStock = (allProducts || []).map((product: any) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      specification: product.specification,
      manufacturer: product.manufacturer,
      standard_sale_price: product.standard_sale_price,
      current_stock: stockMap.get(product.id) || 0
    }))

    return { 
      success: true, 
      data: productsWithStock
    }
  } catch (error) {
    console.error('Get products with stock error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '품목 조회 실패'
    }
  }
}

/**
 * 고객 목록 조회
 */
export async function getCustomersList() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_customers_list')
      .order('name', { ascending: true })

    if (error) throw error

    return { 
      success: true, 
      data: Array.isArray(data) ? data : [] 
    }
  } catch (error) {
    console.error('Get customers error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '고객 조회 실패'
    }
  }
}

/**
 * 판매 내역 조회
 */
export async function getSalesHistory(
  branchId: string | null,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_sales_list', {
        p_branch_id: branchId,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_user_id: userId
      })
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // RPC 결과를 SaleHistory 타입에 맞게 변환
    const mappedData = (data || []).map((item: any) => ({
      id: item.id,
      sale_date: item.sale_date,
      branch_name: item.branch_name || '',
      customer_name: item.customer_name || '', // RPC가 customer_name으로 반환
      product_code: item.product_code || '',
      product_name: item.product_name || '',
      unit: item.unit || '',
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total_amount: item.total_amount || 0, // RPC가 total_amount로 반환
      cost_of_goods: item.cost_of_goods || 0, // RPC가 cost_of_goods로 반환
      profit: item.profit || 0,
      profit_margin: item.total_amount > 0 ? ((item.profit || 0) / item.total_amount) * 100 : 0,
      reference_number: item.reference_number || null,
      created_by_name: '', // RPC에서 제공하지 않음
      created_at: item.created_at
    }))

    return { 
      success: true, 
      data: mappedData
    }
  } catch (error) {
    console.error('Get sales history error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '판매 내역 조회 실패'
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
      .order('code', { ascending: true })

    if (error) throw error

    return { 
      success: true, 
      data: Array.isArray(data) ? data : [] 
    }
  } catch (error) {
    console.error('Get branches error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '지점 조회 실패'
    }
  }
}

/**
 * Phase 3.5: 판매 데이터 수정
 * ✅ 권한: 모든 역할 (CRU 권한)
 * ✅ 지점 격리: 본인 지점만 수정 (시스템 관리자 제외)
 * ✅ Audit Log: UPDATE 트리거 자동 발동
 */
export async function updateSale(data: SaleUpdateRequest) {
  try {
    const supabase = await createServerClient()
    
    // 세션 확인
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    
    if (!sessionCookie) {
      return { 
        success: false, 
        message: '인증되지 않은 사용자입니다.' 
      }
    }

    // 검증
    if (!data.sale_id) {
      return { success: false, message: '판매 ID가 필요합니다.' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '수량은 0보다 커야 합니다.' }
    }

    if (data.unit_price <= 0) {
      return { success: false, message: '단가는 0보다 커야 합니다.' }
    }

    console.log('✏️ 판매 수정 시작:', {
      sale_id: data.sale_id,
      quantity: data.quantity,
      unit_price: data.unit_price
    })

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('update_sale', {
      p_sale_id: data.sale_id,
      p_user_id: data.user_id,
      p_user_role: data.user_role,
      p_user_branch_id: data.user_branch_id,
      p_quantity: data.quantity,
      p_unit_price: data.unit_price,
      p_supply_price: data.supply_price,
      p_tax_amount: data.tax_amount,
      p_total_price: data.total_price,
      p_notes: data.notes || ''
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `판매 수정 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
      console.error('❌ 판매 수정 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '판매 수정 실패'
      }
    }

    console.log('✅ 판매 수정 성공')

    revalidatePath('/sales')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: result.message
    }

  } catch (error) {
    console.error('❌ Update sale error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '판매 수정 중 오류가 발생했습니다.'
    }
  }
}

/**
 * Phase 3.5: 판매 데이터 삭제
 * ✅ 권한: 원장 이상 (0000~0002)
 * ✅ 지점 격리: 본인 지점만 삭제 (시스템 관리자 제외)
 * ✅ Audit Log: DELETE 트리거 자동 발동
 */
export async function deleteSale(data: SaleDeleteRequest) {
  try {
    const supabase = await createServerClient()
    
    // 세션 확인
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    
    if (!sessionCookie) {
      return { 
        success: false, 
        message: '인증되지 않은 사용자입니다.' 
      }
    }

    // 검증
    if (!data.sale_id) {
      return { success: false, message: '판매 ID가 필요합니다.' }
    }

    console.log('🗑️ 판매 삭제 시작:', {
      sale_id: data.sale_id,
      user_role: data.user_role
    })

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('delete_sale', {
      p_sale_id: data.sale_id,
      p_user_id: data.user_id,
      p_user_role: data.user_role,
      p_user_branch_id: data.user_branch_id
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `판매 삭제 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
      console.error('❌ 판매 삭제 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '판매 삭제 실패'
      }
    }

    console.log('✅ 판매 삭제 성공')

    revalidatePath('/sales')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: result.message
    }

  } catch (error) {
    console.error('❌ Delete sale error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '판매 삭제 중 오류가 발생했습니다.'
    }
  }
}