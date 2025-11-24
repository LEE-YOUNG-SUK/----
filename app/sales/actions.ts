'use server'

/**
 * 판매 관리 Server Actions
 * 입고 관리(purchases/actions.ts) 구조 100% 적용
 */

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { SaleSaveRequest, SaleRpcResponse } from '@/types/sales'

/**
 * 판매 데이터 일괄 저장
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

    // 각 품목별로 판매 처리
    const results: SaleRpcResponse[] = []
    const errors: string[] = []

    for (const item of data.items) {
      if (!item.product_id) {
        errors.push(`품목을 선택해주세요. (행: ${item.product_code || '미입력'})`)
        continue
      }
      
      if (item.quantity <= 0) {
        errors.push(`수량은 0보다 커야 합니다. (품목: ${item.product_name})`)
        continue
      }
      
      if (item.unit_price <= 0) {
        errors.push(`단가는 0보다 커야 합니다. (품목: ${item.product_name})`)
        continue
      }

      if (item.quantity > item.current_stock) {
        errors.push(`재고가 부족합니다. (품목: ${item.product_name}, 재고: ${item.current_stock})`)
        continue
      }

      console.log(`📦 품목 저장 중: ${item.product_name}`, {
        branch_id: data.branch_id,
        client_id: data.customer_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      })

      // RPC 함수 호출
      const { data: rpcData, error } = await supabase
        .rpc('process_sale_with_fifo', {
          p_branch_id: data.branch_id,
          p_client_id: data.customer_id,
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_unit_price: item.unit_price,
          p_sale_date: data.sale_date,
          p_reference_number: data.reference_number || '',
          p_notes: item.notes || data.notes || '',
          p_created_by: data.created_by
        })

      if (error) {
        console.error('❌ RPC Error:', error)
        errors.push(`${item.product_name}: ${error.message}`)
      } else if (rpcData && rpcData[0]) {
        console.log('✅ 저장 성공:', rpcData[0])
        results.push(rpcData[0] as SaleRpcResponse)
      }
    }

    if (errors.length > 0) {
      console.error('❌ 에러 발생:', errors)
      return {
        success: false,
        message: `일부 품목 저장 실패:\n${errors.join('\n')}`
      }
    }

    revalidatePath('/sales')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: `${results.length}개 품목 판매 완료`,
      data: results
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
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_sales_list', {
        p_branch_id: branchId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // RPC 결과를 SaleHistory 타입에 맞게 변환
    const mappedData = (data || []).map((item: any) => ({
      id: item.id,
      sale_date: item.sale_date,
      branch_name: item.branch_name || '',
      customer_name: item.client_name || '', // client_name → customer_name
      product_code: item.product_code || '',
      product_name: item.product_name || '',
      unit: item.unit || '',
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total_amount: item.total_price || 0, // total_price → total_amount
      cost_of_goods: item.cost_of_goods_sold || 0, // cost_of_goods_sold → cost_of_goods
      profit: item.profit || 0,
      profit_margin: item.total_price > 0 ? ((item.profit || 0) / item.total_price) * 100 : 0,
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