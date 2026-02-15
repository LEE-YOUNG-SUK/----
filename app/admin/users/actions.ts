'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

/**
 * 사용자 목록 조회 (권한별 지점 격리 적용)
 */
export async function getUsers() {
  try {
    const supabase = await createServerClient()
    
    // 현재 사용자 세션 정보 가져오기
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('erp_session_token')?.value
    
    if (!sessionToken) {
      return []
    }

    // 세션 확인 및 사용자 정보 가져오기
    const { data: sessionData } = await supabase.rpc('verify_session', {
      p_token: sessionToken
    })

    if (!sessionData?.[0]?.valid) {
      return []
    }

    const currentRole = sessionData[0].role
    const currentBranchId = sessionData[0].branch_id
    
    // RPC 함수를 사용하여 권한별 사용자 조회
    const { data: usersData, error: rpcError } = await supabase.rpc('get_all_users', {
      p_user_role: currentRole,
      p_user_branch_id: currentBranchId
    })
    
    if (rpcError) {
      return []
    }

    return usersData || []
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
    
    if (error) {
      console.error('❌ [Users Actions] 지점 조회 에러:', error)
      return []
    }
    
    return data
  } catch (error) {
    console.error('❌ [Users Actions] 지점 조회 실패:', error)
    return []
  }
}

/**
 * 사용자 저장 (생성 또는 수정)
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
  const supabase = await createServerClient()
  
  try {
    // 현재 사용자 정보 가져오기
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('erp_session_token')?.value
    
    if (!sessionToken) {
      return { success: false, message: '인증되지 않은 사용자입니다' }
    }

    // 세션 확인 및 사용자 ID 가져오기
    const { data: sessionData } = await supabase.rpc('verify_session', { 
      p_token: sessionToken 
    })
    
    if (!sessionData?.[0]?.valid) {
      return { success: false, message: '세션이 만료되었습니다' }
    }

    const currentUserId = sessionData[0].user_id
    const currentRole = sessionData[0].role
    const currentBranchId = sessionData[0].branch_id

    // 역할 0001, 0002, 0003은 지점 필수
    if (['0001', '0002', '0003'].includes(formData.role) && !formData.branch_id) {
      return { success: false, message: '원장, 매니저, 직원은 소속 지점을 선택해야 합니다' }
    }

    if (formData.id) {
      // 수정
      const { data, error } = await supabase.rpc('update_user', {
        p_user_id: formData.id,
        p_display_name: formData.display_name,
        p_role: formData.role,
        p_branch_id: formData.branch_id || null,
        p_is_active: formData.is_active,
        p_updated_by: currentUserId,
        p_updater_role: currentRole
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
        p_created_by: currentUserId
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
    console.error('사용자 저장 에러:', error)
    return { success: false, message: error.message || '사용자 저장에 실패했습니다' }
  }
}

/**
 * 사용자 삭제
 */
export async function deleteUser(userId: string) {
  const supabase = await createServerClient()
  
  try {
    // 현재 사용자 정보 가져오기
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('erp_session_token')?.value
    
    if (!sessionToken) {
      return { success: false, message: '인증되지 않은 사용자입니다' }
    }

    // 세션 확인 및 사용자 ID 가져오기
    const { data: sessionData } = await supabase.rpc('verify_session', { 
      p_token: sessionToken 
    })
    
    if (!sessionData?.[0]?.valid) {
      return { success: false, message: '세션이 만료되었습니다' }
    }

    const currentUserId = sessionData[0].user_id
    const currentRole = sessionData[0].role
    
    const { data, error } = await supabase.rpc('delete_user', {
      p_user_id: userId,
      p_deleted_by: currentUserId,
      p_deleter_role: currentRole
    })
    
    if (error) throw error
    
    const result = data?.[0]
    if (!result?.success) {
      throw new Error(result?.message || '사용자 삭제 실패')
    }
    
    revalidatePath('/admin/users')
    return { success: true, message: '사용자가 삭제되었습니다' }
  } catch (error: any) {
    console.error('사용자 삭제 에러:', error)
    return { success: false, message: error.message || '사용자 삭제에 실패했습니다' }
  }
}
