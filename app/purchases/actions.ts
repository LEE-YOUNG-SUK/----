'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { 
  PurchaseSaveRequest, 
  BatchPurchaseResponse,
  PurchaseUpdateRequest,
  PurchaseDeleteRequest 
} from '@/types/purchases'

/**
 * 입고 데이터 일괄 저장 (Phase 1: 트랜잭션 처리 강화)
 * ✅ 전체 성공 또는 전체 실패 (원자성 보장)
 * ✅ 거래번호 자동 생성
 * ✅ 권한 검증 (본인 지점만)
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
    // ✅ 공급업체 필수 검증 제거 (선택사항으로 변경)
    
    if (!data.purchase_date) {
      return { success: false, message: '입고일을 선택해주세요.' }
    }
    
    if (!data.branch_id) {
      return { success: false, message: '지점을 선택해주세요.' }
    }
    
    if (data.items.length === 0) {
      return { success: false, message: '입고할 품목이 없습니다.' }
    }

    // 빈 행 필터링 (product_id 없는 행 제외)
    const validItems = data.items.filter(item => item.product_id && item.product_id.trim() !== '')
    
    if (validItems.length === 0) {
      return { success: false, message: '유효한 품목이 없습니다.' }
    }

    // JSONB 형식으로 변환
    const itemsJson = validItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      supply_price: item.supply_price || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price || (item.quantity * item.unit_cost),
      notes: item.notes || ''
    }))

    // ✅ Phase 3: Audit Log - 사용자 컨텍스트 설정 (SQL 인젝션 방지)
    const { error: configError } = await supabase.rpc('set_current_user_context', {
      p_user_id: data.created_by
    })
    
    if (configError) {
      console.error('❌ Config Error:', configError)
      // 컨텍스트 설정 실패는 warning으로 처리 (비즈니스 로직 중단 안함)
    }

    // ✅ 단일 RPC 호출 (트랜잭션 보장)
    const { data: rpcData, error } = await supabase.rpc('process_batch_purchase', {
      p_branch_id: data.branch_id,
      p_client_id: data.supplier_id,
      p_purchase_date: data.purchase_date,
      p_reference_number: data.reference_number || null,  // NULL이면 자동 생성
      p_notes: data.notes || '',
      p_created_by: data.created_by,
      p_items: itemsJson as any
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `입고 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0] as BatchPurchaseResponse

    if (!result || !result.success) {
      console.error('❌ 입고 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '입고 저장 실패'
      }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')
    
    return {
      success: true,
      message: `${result.total_items}개 품목 입고 완료\n거래번호: ${result.transaction_number}`,
      data: result
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
  userId: string,
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

/**
 * Phase 3.5: 입고 데이터 수정
 * ✅ 권한: 모든 역할 (CRU 권한)
 * ✅ 지점 격리: 본인 지점만 수정 (시스템 관리자 제외)
 * ✅ Audit Log: UPDATE 트리거 자동 발동
 */
export async function updatePurchase(data: PurchaseUpdateRequest) {
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
    if (!data.purchase_id) {
      return { success: false, message: '입고 ID가 필요합니다.' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '수량은 0보다 커야 합니다.' }
    }

    if (data.unit_cost < 0) {
      return { success: false, message: '단가는 0보다 커야 합니다.' }
    }

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('update_purchase', {
      p_purchase_id: data.purchase_id,
      p_user_id: data.user_id,
      p_user_role: data.user_role,
      p_user_branch_id: data.user_branch_id || null,
      p_quantity: data.quantity,
      p_unit_cost: data.unit_cost,
      p_supply_price: data.supply_price,
      p_tax_amount: data.tax_amount,
      p_total_price: data.total_price,
      p_notes: data.notes || ''
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `입고 수정 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
      console.error('❌ 입고 수정 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '입고 수정 실패'
      }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')

    return {
      success: true,
      message: result.message
    }

  } catch (error) {
    console.error('Update purchase error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '입고 수정 중 오류가 발생했습니다.'
    }
  }
}

/**
 * Phase 3.5: 입고 데이터 삭제
 * ✅ 권한: 원장 이상 (0000~0002)
 * ✅ 지점 격리: 본인 지점만 삭제 (시스템 관리자 제외)
 * ✅ Audit Log: DELETE 트리거 자동 발동
 */
export async function deletePurchase(data: PurchaseDeleteRequest) {
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
    if (!data.purchase_id) {
      return { success: false, message: '입고 ID가 필요합니다.' }
    }

    // ✅ RPC 호출 (권한 및 지점 검증 포함, audit_logs 직접 기록)
    const { data: rpcData, error } = await supabase.rpc('delete_purchase', {
      p_purchase_id: data.purchase_id,
      p_user_id: data.user_id,
      p_user_role: data.user_role,
      p_user_branch_id: data.user_branch_id || null
    })

    if (error) {
      console.error('❌ RPC Error:', error)
      return {
        success: false,
        message: `입고 삭제 실패: ${error.message}`
      }
    }

    const result = rpcData?.[0]

    if (!result || !result.success) {
      console.error('❌ 입고 삭제 실패:', result?.message)
      return {
        success: false,
        message: result?.message || '입고 삭제 실패'
      }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')

    return {
      success: true,
      message: result.message
    }

  } catch (error) {
    console.error('Delete purchase error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '입고 삭제 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 기존 거래에 입고 품목 추가
 */
export async function addPurchaseItem(data: {
  reference_number: string
  branch_id: string
  product_id: string
  client_id: string | null
  purchase_date: string
  quantity: number
  unit_cost: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
  user_id: string
  user_role: string
  user_branch_id: string
}) {
  try {
    const supabase = await createServerClient()

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('erp_session_token')
    if (!sessionCookie) {
      return { success: false, message: '인증되지 않은 사용자입니다.' }
    }

    if (data.quantity <= 0) {
      return { success: false, message: '수량은 0보다 커야 합니다.' }
    }

    const { data: rpcData, error } = await supabase.rpc('add_purchase_item', {
      p_reference_number: data.reference_number,
      p_branch_id: data.branch_id,
      p_product_id: data.product_id,
      p_client_id: data.client_id,
      p_purchase_date: data.purchase_date,
      p_quantity: data.quantity,
      p_unit_cost: data.unit_cost,
      p_supply_price: data.supply_price,
      p_tax_amount: data.tax_amount,
      p_total_price: data.total_price,
      p_notes: data.notes || '',
      p_user_id: data.user_id,
      p_user_role: data.user_role,
      p_user_branch_id: data.user_branch_id || null
    })

    if (error) {
      return { success: false, message: `품목 추가 실패: ${error.message}` }
    }

    const result = rpcData?.[0]
    if (!result || !result.success) {
      return { success: false, message: result?.message || '품목 추가 실패' }
    }

    revalidatePath('/purchases')
    revalidatePath('/inventory')

    return { success: true, message: result.message, purchase_id: result.purchase_id }
  } catch (error) {
    console.error('Add purchase item error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '품목 추가 중 오류가 발생했습니다.'
    }
  }
}