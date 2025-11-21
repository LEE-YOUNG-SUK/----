'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Product } from '@/types'

/**
 * 품목 목록 조회
 */
export async function getProducts() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_products_list')
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
 * 품목 저장 (생성 또는 수정)
 */
export async function saveProduct(formData: {
  id?: string
  code: string
  name: string
  category: string | null
  unit: string
  specification: string | null
  manufacturer: string | null
  barcode: string | null
  min_stock_level: number | null
  standard_purchase_price: number | null
  standard_sale_price: number | null
  is_active: boolean
}) {
  const supabase = await createServerClient()
  
  try {
    if (formData.id) {
      // 수정
      const { error } = await supabase
        .from('products')
        .update({
          code: formData.code,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          specification: formData.specification,
          manufacturer: formData.manufacturer,
          barcode: formData.barcode,
          min_stock_level: formData.min_stock_level,
          standard_purchase_price: formData.standard_purchase_price,
          standard_sale_price: formData.standard_sale_price,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', formData.id)
      
      if (error) throw error
      
      revalidatePath('/products')
      return { success: true, message: '품목이 수정되었습니다' }
    } else {
      // 생성
      const { error } = await supabase
        .from('products')
        .insert({
          code: formData.code,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          specification: formData.specification,
          manufacturer: formData.manufacturer,
          barcode: formData.barcode,
          min_stock_level: formData.min_stock_level,
          standard_purchase_price: formData.standard_purchase_price,
          standard_sale_price: formData.standard_sale_price,
          is_active: formData.is_active
        })
      
      if (error) {
        if (error.code === '23505') {
          return { success: false, message: '이미 존재하는 품목 코드입니다' }
        }
        throw error
      }
      
      revalidatePath('/products')
      return { success: true, message: '품목이 생성되었습니다' }
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
  const supabase = await createServerClient()
  
  try {
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
