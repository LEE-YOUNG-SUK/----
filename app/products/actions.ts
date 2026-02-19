'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import type { Product, ProductCategory } from '@/types'

/**
 * 품목 목록 조회
 */
export async function getProducts() {
  try {
    const session = await getSession()
    if (!session) return []

    // 본사 관리자/원장 → 전체 조회; 나머지 → 공통 + 본인 지점
    const branchId = session.is_headquarters && ['0000', '0001'].includes(session.role) ? null : session.branch_id

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .rpc('get_products_list', { p_branch_id: branchId })
      .order('code', { ascending: true })
    
    if (error) {
      console.error('❌ [Products Actions] 품목 조회 에러:', error)
      return []
    }
    
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('❌ [Products Actions] 품목 조회 실패:', error)
    return []
  }
}

/**
 * 카테고리 목록 조회
 */
export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_product_categories')
    
    if (error) {
      console.error('❌ [Products Actions] 카테고리 조회 에러:', error)
      return []
    }
    
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('❌ [Products Actions] 카테고리 조회 실패:', error)
    return []
  }
}

/**
 * 품목 저장 (생성 또는 수정)
 */
export async function saveProduct(formData: {
  id?: string
  code: string
  name: string
  category_id: string | null
  unit: string
  specification: string | null
  manufacturer: string | null
  barcode: string | null
  min_stock_level: number | null
  standard_purchase_price: number | null
  standard_sale_price: number | null
  is_active: boolean
  created_by?: string | null
  branch_id?: string | null
}) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }

  const canManageCommon = session.is_headquarters && ['0000', '0001'].includes(session.role)
  const canManageBranch = ['0001', '0002'].includes(session.role)
  if (!canManageCommon && !canManageBranch) {
    return { success: false, message: '품목 관리 권한이 없습니다.' }
  }

  const supabase = await createServerClient()

  try {
    if (formData.id) {
      // 수정 시 소유권 검증
      const { data: existing } = await supabase
        .from('products')
        .select('branch_id')
        .eq('id', formData.id)
        .single()

      if (!existing) return { success: false, message: '품목을 찾을 수 없습니다.' }

      if (existing.branch_id === null && !canManageCommon) {
        return { success: false, message: '공통 품목은 관리자만 수정할 수 있습니다.' }
      }
      if (existing.branch_id && existing.branch_id !== session.branch_id && !(session.is_headquarters && ['0000', '0001'].includes(session.role))) {
        return { success: false, message: '다른 지점의 품목은 수정할 수 없습니다.' }
      }

      const { data, error } = await supabase.rpc('update_product', {
        p_id: formData.id,
        p_name: formData.name,
        p_category_id: formData.category_id || null,
        p_unit: formData.unit,
        p_specification: formData.specification,
        p_manufacturer: formData.manufacturer,
        p_barcode: formData.barcode,
        p_min_stock_level: formData.min_stock_level,
        p_standard_purchase_price: formData.standard_purchase_price,
        p_standard_sale_price: formData.standard_sale_price,
        p_is_active: formData.is_active
      })

      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      revalidatePath('/products')
      return {
        success: result?.success ?? true,
        message: result?.message ?? '품목이 수정되었습니다'
      }
    } else {
      // 생성: 역할에 따라 branch_id 결정
      const branchIdForCreate = canManageCommon ? null : session.branch_id

      const { data, error } = await supabase.rpc('create_product', {
        p_code: formData.code,
        p_name: formData.name,
        p_category_id: formData.category_id || null,
        p_unit: formData.unit,
        p_specification: formData.specification,
        p_manufacturer: formData.manufacturer,
        p_barcode: formData.barcode,
        p_min_stock_level: formData.min_stock_level,
        p_standard_purchase_price: formData.standard_purchase_price,
        p_standard_sale_price: formData.standard_sale_price,
        p_created_by: session.user_id,
        p_branch_id: branchIdForCreate
      })

      if (error) throw error

      const result = Array.isArray(data) ? data[0] : data
      revalidatePath('/products')
      return {
        success: result?.success ?? true,
        message: result?.message ?? '품목이 생성되었습니다',
        product_id: result?.product_id
      }
    }
  } catch (error: any) {
    console.error('품목 저장 에러:', error)
    return { success: false, message: error.message || '품목 저장에 실패했습니다' }
  }
}

/**
 * 품목 삭제
 */
export async function deleteProduct(productId: string) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }

  const canManageCommon = session.is_headquarters && ['0000', '0001'].includes(session.role)
  const canManageBranch = ['0001', '0002'].includes(session.role)
  if (!canManageCommon && !canManageBranch) {
    return { success: false, message: '품목 삭제 권한이 없습니다.' }
  }

  const supabase = await createServerClient()

  try {
    // 소유권 검증
    const { data: existing } = await supabase
      .from('products')
      .select('branch_id')
      .eq('id', productId)
      .single()

    if (!existing) return { success: false, message: '품목을 찾을 수 없습니다.' }

    if (existing.branch_id === null && !canManageCommon) {
      return { success: false, message: '공통 품목은 관리자만 삭제할 수 있습니다.' }
    }
    if (existing.branch_id && existing.branch_id !== session.branch_id && !(session.is_headquarters && ['0000', '0001'].includes(session.role))) {
      return { success: false, message: '다른 지점의 품목은 삭제할 수 없습니다.' }
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
    
    if (error) {
      if (error.code === '23503') {
        return { success: false, message: '사용 중인 품목은 삭제할 수 없습니다' }
      }
      throw error
    }
    
    revalidatePath('/products')
    return { success: true, message: '품목이 삭제되었습니다' }
  } catch (error: any) {
    console.error('품목 삭제 에러:', error)
    return { success: false, message: error.message || '품목 삭제에 실패했습니다' }
  }
}
