'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { PurchaseSaveRequest, PurchaseRpcResponse } from '@/types/purchases'

/**
 * 입고 데이터 일괄 저장
 */
export async function savePurchases(data: PurchaseSaveRequest) {
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
    if (!data.supplier_id) {
      return { success: false, message: '공급업체를 선택해주세요.' }
    }
    
    if (!data.purchase_date) {
      return { success: false, message: '입고일을 선택해주세요.' }
    }
    
    if (!data.branch_id) {
      return { success: false, message: '지점을 선택해주세요.' }
    }
    
    if (data.items.length === 0) {
      return { success: false, message: '입고할 품목이 없습니다.' }
    }

    // 각 품목별로 입고 처리
    const results: PurchaseRpcResponse[] = []
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
      if (item.unit_cost <= 0) {
        errors.push(`단가는 0보다 커야 합니다. (품목: ${item.product_name})`)
        continue
      }

      // RPC 함수 호출 (재고 레이어는 DB에서 처리)
      const { data: rpcData, error } = await supabase
        .rpc('process_purchase_with_layers', {
          p_branch_id: data.branch_id,
          p_client_id: data.supplier_id,
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_unit_cost: item.unit_cost,
          p_purchase_date: data.purchase_date,
          p_reference_number: data.reference_number || '',
          p_notes: item.notes || data.notes || '',
          p_created_by: data.created_by
        })

      if (error) {
        console.error('❌ RPC Error:', error)
        errors.push(`${item.product_name}: ${error.message}`)
      } else if (rpcData && rpcData[0]) {
        results.push(rpcData[0] as PurchaseRpcResponse)
      }
    }

    if (errors.length > 0) {
      console.error('❌ 에러 발생:', errors)
      return {
        success: false,
        message: `일부 품목 저장 실패:\n${errors.join('\n')}`
      }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: `${results.length}개 품목 입고 완료`,
      data: results
    }

  } catch (error) {
    console.error('❌ Save purchases error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '입고 저장 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 품목 목록 조회
 */
export async function getProductsList() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_products_list')
      .order('code', { ascending: true })

    if (error) throw error

    return { 
      success: true, 
      data: Array.isArray(data) ? data : [] 
    }
  } catch (error) {
    console.error('Get products error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '품목 조회 실패'
    }
  }
}

/**
 * 공급업체 목록 조회
 */
export async function getSuppliersList() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_suppliers_list')
      .order('name', { ascending: true })

    if (error) throw error

    return { 
      success: true, 
      data: Array.isArray(data) ? data : [] 
    }
  } catch (error) {
    console.error('Get suppliers error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '공급업체 조회 실패'
    }
  }
}

/**
 * 입고 내역 조회
 */
export async function getPurchasesHistory(
  branchId: string | null,
  startDate?: string,
  endDate?: string
) {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_purchases_list', {
        p_branch_id: branchId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return { 
      success: true, 
      data: Array.isArray(data) ? data : [] 
    }
  } catch (error) {
    console.error('Get purchases history error:', error)
    return { 
      success: false, 
      data: [],
      message: error instanceof Error ? error.message : '입고 내역 조회 실패'
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