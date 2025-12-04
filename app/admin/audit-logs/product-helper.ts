'use server'

import { createServerClient } from '@/lib/supabase/server'

/**
 * 품목 ID로 품목명 조회 (감사로그용)
 */
export async function getProductNameById(productId: string): Promise<string | null> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('products')
      .select('name')
      .eq('id', productId)
      .single()
    
    if (error || !data) {
      return null
    }
    
    return data.name
  } catch (error) {
    console.error('Get product name error:', error)
    return null
  }
}

/**
 * 여러 품목 ID로 품목명 일괄 조회 (감사로그용)
 */
export async function getProductNamesByIds(productIds: string[]): Promise<Record<string, string>> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds)
    
    if (error || !data) {
      return {}
    }
    
    // Record 형태로 변환
    const productMap: Record<string, string> = {}
    data.forEach(product => {
      productMap[product.id] = product.name
    })
    
    return productMap
  } catch (error) {
    console.error('Get product names error:', error)
    return {}
  }
}
