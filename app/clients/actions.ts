'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Client } from '@/types'

/**
 * 거래처 목록 조회
 */
export async function getClients() {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .rpc('get_clients_list')
      .order('code', { ascending: true })
    
    if (error) {
      console.error('❌ [Clients Actions] 거래처 조회 에러:', error)
      return []
    }
    
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('❌ [Clients Actions] 거래처 조회 실패:', error)
    return []
  }
}

/**
 * 거래처 저장 (생성 또는 수정)
 */
export async function saveClient(formData: {
  id?: string
  code: string
  name: string
  type: 'supplier' | 'customer' | 'both'
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  is_active: boolean
}) {
  const supabase = await createServerClient()
  
  try {
    if (formData.id) {
      // 수정
      const { error } = await supabase
        .from('clients')
        .update({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tax_id: formData.tax_id,
          notes: formData.notes,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', formData.id)
      
      if (error) throw error
      
      revalidatePath('/clients')
      return { success: true, message: '거래처가 수정되었습니다' }
    } else {
      // 생성
      const { error } = await supabase
        .from('clients')
        .insert({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tax_id: formData.tax_id,
          notes: formData.notes,
          is_active: formData.is_active
        })
      
      if (error) {
        if (error.code === '23505') {
          return { success: false, message: '이미 존재하는 거래처 코드입니다' }
        }
        throw error
      }
      
      revalidatePath('/clients')
      return { success: true, message: '거래처가 생성되었습니다' }
    }
  } catch (error: any) {
    console.error('거래처 저장 에러:', error)
    return { success: false, message: error.message || '거래처 저장에 실패했습니다' }
  }
}

/**
 * 거래처 삭제
 */
export async function deleteClient(clientId: string) {
  const supabase = await createServerClient()
  
  try {
    const { error} = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
    
    if (error) {
      if (error.code === '23503') {
        return { success: false, message: '사용 중인 거래처는 삭제할 수 없습니다' }
      }
      throw error
    }
    
    revalidatePath('/clients')
    return { success: true, message: '거래처가 삭제되었습니다' }
  } catch (error: any) {
    console.error('거래처 삭제 에러:', error)
    return { success: false, message: error.message || '거래처 삭제에 실패했습니다' }
  }
}
