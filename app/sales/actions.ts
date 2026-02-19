'use server'

/**
 * 판매 관리 Server Actions (Phase 1: 트랜잭션 처리 강화)
 */

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { validateDateRange } from '@/lib/date-utils'
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
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    // 검증
    // ✅ 고객 필수 검증 제거 (선택사항으로 변경)
    
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

    // 서버 측 item 유효성 검증
    for (const item of validItems) {
      if (!item.quantity || item.quantity <= 0) {
        return { success: false, message: `수량은 0보다 커야 합니다. (품목: ${item.product_name || item.product_id})` }
      }
      if (item.unit_price < 0) {
        return { success: false, message: `단가는 0 이상이어야 합니다. (품목: ${item.product_name || item.product_id})` }
      }
    }

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

    // ✅ Phase 3: Audit Log - 사용자 컨텍스트 설정
    const { error: configError } = await supabase.rpc('set_current_user_context', {
      p_user_id: session.user_id
    })

    if (configError) {
      console.error('Config Error:', configError.message)
    }

    // ✅ 단일 RPC 호출 (트랜잭션 보장)
    const { data: rpcData, error } = await supabase.rpc('process_batch_sale', {
      p_branch_id: data.branch_id,
      p_client_id: data.customer_id,
      p_sale_date: data.sale_date,
      p_reference_number: data.reference_number || null,
      p_notes: data.notes || '',
      p_created_by: session.user_id,
      p_items: itemsJson as any,
      p_transaction_type: data.transaction_type || 'SALE'  // ✅ 거래유형 전달
    })

    if (error) {
      return {
        success: false,
        message: `판매 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0] as BatchSaleResponse

    if (!result || !result.success) {
      return {
        success: false,
        message: result?.message || '판매 저장 실패'
      }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: `${result.total_items}개 품목 판매 완료\n거래번호: ${result.transaction_number}\n이익: ${(result.total_profit || 0).toLocaleString()}원`,
      data: result
    }

  } catch (error) {
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
export async function getProductsWithStock(branchId: string | null, productBranchId?: string | null) {
  try {
    const supabase = await createServerClient()

    // 품목 필터용 branch_id (별도 지정 가능)
    const pBranchId = productBranchId !== undefined ? productBranchId : branchId

    // 1+2. 품목 + 재고 병렬 조회
    let inventoryQuery = supabase
      .from('inventory_layers')
      .select('product_id, remaining_quantity')
      .gt('remaining_quantity', 0)

    if (branchId) {
      inventoryQuery = inventoryQuery.eq('branch_id', branchId)
    }

    const [{ data: allProducts, error: productsError }, { data: inventoryData, error: inventoryError }] = await Promise.all([
      supabase.rpc('get_products_list', { p_branch_id: pBranchId }).order('code', { ascending: true }),
      inventoryQuery
    ])

    if (productsError) throw productsError
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
  startDate?: string,
  endDate?: string,
  transactionType?: 'SALE' | 'USAGE'
) {
  try {
    const dateError = validateDateRange(startDate, endDate)
    if (dateError) return { success: false, data: [], message: dateError }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .rpc('get_sales_list', {
        p_branch_id: branchId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })

    if (error) throw error

    // RPC 결과를 SaleHistory 타입에 맞게 변환
    const mappedData = (data || [])
      .filter((item: any) => !transactionType || item.transaction_type === transactionType)
      .map((item: any) => ({
        id: item.id,
        branch_id: item.branch_id || '',
        client_id: item.client_id || null,
        product_id: item.product_id || '',
        sale_date: item.sale_date,
        branch_name: item.branch_name || '',
        customer_name: item.customer_name || '',
        product_code: item.product_code || '',
        product_name: item.product_name || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        supply_price: item.supply_price || 0,
        tax_amount: item.tax_amount || 0,
        total_price: item.total_price || 0,
        cost_of_goods_sold: item.cost_of_goods_sold || 0,
        profit: item.profit || 0,
        profit_margin: item.total_price > 0 ? ((item.profit || 0) / item.total_price) * 100 : 0,
        reference_number: item.reference_number || null,
        notes: item.notes || '',
        created_by_name: item.created_by_name || '알 수 없음',
        created_at: item.created_at,
        transaction_type: item.transaction_type || 'SALE',
        updated_by: item.updated_by || null,
        updated_by_name: item.updated_by_name || null,
        updated_at: item.updated_at || null
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
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    // 검증
    if (!data.sale_id) {
      return { success: false, message: '판매 ID가 필요합니다.' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '수량은 0보다 커야 합니다.' }
    }

    if (data.unit_price < 0) {
      return { success: false, message: '단가는 0 이상이어야 합니다.' }
    }

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('update_sale', {
      p_sale_id: data.sale_id,
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id || null,
      p_quantity: data.quantity,
      p_unit_price: data.unit_price,
      p_supply_price: data.supply_price,
      p_tax_amount: data.tax_amount,
      p_total_price: data.total_price,
      p_notes: data.notes || ''
    })

    if (error) {
            return {
        success: false,
        message: `판매 수정 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
            return {
        success: false,
        message: result?.message || '판매 수정 실패'
      }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')

    return {
      success: true,
      message: result.message
    }

  } catch (error) {
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
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    // 검증
    if (!data.sale_id) {
      return { success: false, message: '판매 ID가 필요합니다.' }
    }

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('delete_sale', {
      p_sale_id: data.sale_id,
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id || null
    })

    if (error) {
            return {
        success: false,
        message: `판매 삭제 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
            return {
        success: false,
        message: result?.message || '판매 삭제 실패'
      }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')

    return {
      success: true,
      message: result.message
    }

  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '판매 삭제 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 기존 거래에 판매 품목 추가
 */
export async function addSaleItem(data: {
  reference_number: string
  branch_id: string
  product_id: string
  client_id: string | null
  sale_date: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
  transaction_type: 'SALE' | 'USAGE'
}) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    const supabase = await createServerClient()

    if (!data.product_id) {
      return { success: false, message: '품목을 선택해주세요.' }
    }
    if (data.quantity <= 0) {
      return { success: false, message: '수량은 0보다 커야 합니다.' }
    }
    if (data.unit_price < 0) {
      return { success: false, message: '단가는 0 이상이어야 합니다.' }
    }

    const { data: rpcData, error } = await supabase.rpc('add_sale_item', {
      p_reference_number: data.reference_number,
      p_branch_id: data.branch_id,
      p_product_id: data.product_id,
      p_client_id: data.client_id,
      p_sale_date: data.sale_date,
      p_quantity: data.quantity,
      p_unit_price: data.unit_price,
      p_supply_price: data.supply_price,
      p_tax_amount: data.tax_amount,
      p_total_price: data.total_price,
      p_notes: data.notes || '',
      p_user_id: session.user_id,
      p_user_role: session.role,
      p_user_branch_id: session.branch_id || null,
      p_transaction_type: data.transaction_type || 'SALE'
    })

    if (error) {
      return { success: false, message: `품목 추가 실패: ${error.message}` }
    }

    const result = rpcData?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '품목 추가 실패' }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')

    return { success: true, message: result.message, sale_id: result.sale_id }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '품목 추가 중 오류가 발생했습니다.'
    }
  }
}