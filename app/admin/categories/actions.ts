'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export interface ProductCategory {
  id: string
  code: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  product_count: number
  created_at: string
  updated_at: string
}

/**
 * 카테고리 목록 조회
 */
export async function getCategories(): Promise<ProductCategory[]> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase.rpc('get_categories_list')
    
    if (error) {
      console.error('❌ [Categories Actions] 카테고리 조회 에러:', error)
      return []
    }
    
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('❌ [Categories Actions] 카테고리 조회 실패:', error)
    return []
  }
}

/**
 * 카테고리 저장 (생성 또는 수정)
 */
export async function saveCategory(formData: {
  id?: string
  code: string
  name: string
  description: string | null
  display_order: number
  is_active?: boolean
}) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '카테고리 관리 권한이 없습니다.' }

  const supabase = await createServerClient()
  
  try {
    if (formData.id) {
      // 수정
      const { data, error } = await supabase.rpc('update_category', {
        p_id: formData.id,
        p_code: formData.code,
        p_name: formData.name,
        p_description: formData.description,
        p_display_order: formData.display_order,
        p_is_active: formData.is_active ?? true
      })
      
      if (error) throw error
      
      const result = Array.isArray(data) ? data[0] : data
      revalidatePath('/admin/categories')
      return { 
        success: result?.success ?? true, 
        message: result?.message ?? '카테고리가 수정되었습니다' 
      }
    } else {
      // 생성
      const { data, error } = await supabase.rpc('create_category', {
        p_code: formData.code,
        p_name: formData.name,
        p_description: formData.description,
        p_display_order: formData.display_order
      })
      
      if (error) throw error
      
      const result = Array.isArray(data) ? data[0] : data
      revalidatePath('/admin/categories')
      return { 
        success: result?.success ?? true, 
        message: result?.message ?? '카테고리가 생성되었습니다',
        category_id: result?.category_id
      }
    }
  } catch (error: any) {
    console.error('카테고리 저장 에러:', error)
    return { success: false, message: error.message || '카테고리 저장에 실패했습니다' }
  }
}

/**
 * 카테고리 삭제
 */
export async function deleteCategory(categoryId: string) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '카테고리 삭제 권한이 없습니다.' }

  const supabase = await createServerClient()
  
  try {
    const { data, error } = await supabase.rpc('delete_category', {
      p_id: categoryId
    })
    
    if (error) throw error
    
    const result = Array.isArray(data) ? data[0] : data
    revalidatePath('/admin/categories')
    return { 
      success: result?.success ?? false, 
      message: result?.message ?? '카테고리 삭제에 실패했습니다' 
    }
  } catch (error: any) {
    console.error('카테고리 삭제 에러:', error)
    return { success: false, message: error.message || '카테고리 삭제에 실패했습니다' }
  }
}

/**
 * 카테고리 표시 순서 변경
 */
export async function updateCategoriesOrder(orders: { id: string; display_order: number }[]) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '카테고리 관리 권한이 없습니다.' }

  const supabase = await createServerClient()
  
  try {
    const { data, error } = await supabase.rpc('update_categories_order', {
      p_orders: orders as any
    })
    
    if (error) throw error
    
    const result = Array.isArray(data) ? data[0] : data
    revalidatePath('/admin/categories')
    return { 
      success: result?.success ?? true, 
      message: result?.message ?? '표시 순서가 변경되었습니다' 
    }
  } catch (error: any) {
    console.error('순서 변경 에러:', error)
    return { success: false, message: error.message || '순서 변경에 실패했습니다' }
  }
}

