'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import type { Client } from '@/types'

/**
 * 거래처 목록 조회
 */
export async function getClients() {
  try {
    const session = await getSession()
    if (!session) return []

    // 본사 관리자/원장 → 전체 조회; 나머지 → 공통 + 본인 지점
    const branchId = session.is_headquarters && ['0000', '0001'].includes(session.role) ? null : session.branch_id

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .rpc('get_clients_list', { p_branch_id: branchId })
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
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  is_active: boolean
  created_by?: string | null
  branch_id?: string | null
}) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }

  const canManageCommon = session.is_headquarters && ['0000', '0001'].includes(session.role)
  const canManageBranch = ['0001', '0002'].includes(session.role)
  if (!canManageCommon && !canManageBranch) {
    return { success: false, message: '거래처 관리 권한이 없습니다.' }
  }

  const supabase = await createServerClient()

  try {
    if (formData.id) {
      // 수정 시 소유권 검증
      const { data: existing } = await supabase
        .from('clients')
        .select('branch_id')
        .eq('id', formData.id)
        .single()

      if (!existing) return { success: false, message: '거래처를 찾을 수 없습니다.' }

      if (existing.branch_id === null && !canManageCommon) {
        return { success: false, message: '공통 거래처는 관리자만 수정할 수 있습니다.' }
      }
      if (existing.branch_id && existing.branch_id !== session.branch_id && !canManageCommon) {
        return { success: false, message: '다른 지점의 거래처는 수정할 수 없습니다.' }
      }

      const { error } = await supabase
        .from('clients')
        .update({
          code: formData.code,
          name: formData.name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tax_id: formData.tax_id,
          notes: formData.notes,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
          updated_by: session.user_id
        })
        .eq('id', formData.id)

      if (error) throw error

      revalidatePath('/clients')
      return { success: true, message: '거래처가 수정되었습니다' }
    } else {
      // 생성: 본사 관리자는 폼에서 선택한 branch_id 사용, 지점 사용자는 자기 지점
      const branchIdForCreate = canManageCommon
        ? (formData.branch_id || null)
        : session.branch_id

      const { error } = await supabase
        .from('clients')
        .insert({
          code: formData.code,
          name: formData.name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tax_id: formData.tax_id,
          notes: formData.notes,
          is_active: formData.is_active,
          created_by: session.user_id,
          branch_id: branchIdForCreate
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
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }

  const canManageCommon = session.is_headquarters && ['0000', '0001'].includes(session.role)
  const canManageBranch = ['0001', '0002'].includes(session.role)
  if (!canManageCommon && !canManageBranch) {
    return { success: false, message: '거래처 삭제 권한이 없습니다.' }
  }

  const supabase = await createServerClient()

  try {
    // 소유권 검증
    const { data: existing } = await supabase
      .from('clients')
      .select('branch_id')
      .eq('id', clientId)
      .single()

    if (!existing) return { success: false, message: '거래처를 찾을 수 없습니다.' }

    if (existing.branch_id === null && !canManageCommon) {
      return { success: false, message: '공통 거래처는 관리자만 삭제할 수 있습니다.' }
    }
    if (existing.branch_id && existing.branch_id !== session.branch_id && !canManageCommon) {
      return { success: false, message: '다른 지점의 거래처는 삭제할 수 없습니다.' }
    }

    const { error } = await supabase
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
