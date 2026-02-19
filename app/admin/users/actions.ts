'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

/**
 * 사용자 목록 조회 (권한별 지점 격리 적용)
 * ✅ 권한: 원장(0001) 이상
 */
export async function getUsers() {
  try {
    const session = await getSession()
    if (!session) return []

    // 권한 체크: 원장 이상만 사용자 목록 조회 가능
    if (!['0000', '0001'].includes(session.role)) {
      return []
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_all_users', {
      p_user_role: session.role,
      p_user_branch_id: session.branch_id
    })

    if (error) return []

    return data || []
  } catch {
    return []
  }
}

/**
 * 지점 목록 조회
 */
export async function getBranches() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('branches')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name')

    if (error) return []

    return data
  } catch {
    return []
  }
}

/**
 * 사용자 저장 (생성 또는 수정)
 * ✅ 권한: 원장(0001) 이상
 */
export async function saveUser(formData: {
  id?: string
  username: string
  password?: string
  display_name: string
  role: string
  branch_id?: string | null
  is_active: boolean
}) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다' }
    }

    // 권한 체크: 원장 이상만
    if (!['0000', '0001'].includes(session.role)) {
      return { success: false, message: '사용자 관리 권한이 없습니다' }
    }

    const supabase = await createServerClient()

    // 모든 역할에 지점 필수
    if (!formData.branch_id) {
      return { success: false, message: '소속 지점을 선택해야 합니다' }
    }

    if (formData.id) {
      // 수정
      const { data, error } = await supabase.rpc('update_user', {
        p_user_id: formData.id,
        p_display_name: formData.display_name,
        p_role: formData.role,
        p_branch_id: formData.branch_id || null,
        p_is_active: formData.is_active,
        p_updated_by: session.user_id,
        p_updater_role: session.role
      })

      if (error) throw error

      const result = data?.[0]
      if (!result?.success) {
        throw new Error(result?.message || '사용자 수정 실패')
      }

      // 비밀번호 변경 (입력된 경우)
      if (formData.password) {
        const { data: pwData, error: pwError } = await supabase.rpc('update_user_password', {
          p_user_id: formData.id,
          p_new_password: formData.password
        })

        if (pwError) throw pwError

        const pwResult = pwData?.[0]
        if (!pwResult?.success) {
          throw new Error(pwResult?.message || '비밀번호 변경 실패')
        }
      }
    } else {
      // 생성
      if (!formData.password) {
        return { success: false, message: '비밀번호는 필수입니다' }
      }

      const { data, error } = await supabase.rpc('create_user', {
        p_username: formData.username,
        p_password: formData.password,
        p_display_name: formData.display_name,
        p_role: formData.role,
        p_branch_id: formData.branch_id || null,
        p_created_by: session.user_id
      })

      if (error) throw error

      const result = data?.[0]
      if (!result?.success) {
        throw new Error(result?.message || '사용자 생성 실패')
      }
    }

    revalidatePath('/admin/users')
    return { success: true, message: formData.id ? '사용자가 수정되었습니다' : '사용자가 생성되었습니다' }
  } catch (error: any) {
    return { success: false, message: error.message || '사용자 저장에 실패했습니다' }
  }
}

/**
 * 사용자 삭제
 * ✅ 권한: 원장(0001) 이상
 */
export async function deleteUser(userId: string) {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: '인증되지 않은 사용자입니다' }
    }

    // 권한 체크: 원장 이상만
    if (!['0000', '0001'].includes(session.role)) {
      return { success: false, message: '사용자 삭제 권한이 없습니다' }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('delete_user', {
      p_user_id: userId,
      p_deleted_by: session.user_id,
      p_deleter_role: session.role
    })

    if (error) throw error

    const result = data?.[0]
    if (!result?.success) {
      throw new Error(result?.message || '사용자 삭제 실패')
    }

    revalidatePath('/admin/users')
    return { success: true, message: '사용자가 삭제되었습니다' }
  } catch (error: any) {
    return { success: false, message: error.message || '사용자 삭제에 실패했습니다' }
  }
}
