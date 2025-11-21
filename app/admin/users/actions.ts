'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

/**
 * 사용자 목록 조회
 */
export async function getUsers() {
  try {
    console.log('📊 [Users Actions] getUsers 시작')
    const supabase = await createServerClient()
    
    // RPC 함수를 사용하여 RLS 우회
    const { data: usersData, error: rpcError } = await supabase.rpc('get_all_users')
    
    if (rpcError) {
      console.error('⚠️ [Users Actions] RPC 에러 (직접 조회로 전환):', rpcError)
      
      // RPC 함수가 실패하면 직접 조회 시도
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          display_name,
          role,
          branch_id,
          is_active,
          created_at,
          updated_at,
          branches!inner(name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ [Users Actions] 사용자 조회 에러:', error)
        return []
      }
      
      console.log('✅ [Users Actions] 사용자 조회 성공 (직접):', data?.length || 0)
      return data.map((user: any) => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branches?.name || null,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      }))
    }
    
    console.log('✅ [Users Actions] RPC로 사용자 조회 성공:', usersData?.length || 0)
    return usersData || []
  } catch (error) {
    console.error('❌ [Users Actions] 사용자 조회 실패:', error)
    return []
  }
}

/**
 * 지점 목록 조회
 */
export async function getBranches() {
  try {
    console.log('📊 [Users Actions] getBranches 시작')
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
    
    console.log('✅ [Users Actions] 지점 조회 성공:', data?.length || 0)
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
        p_is_active: formData.is_active
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

      // 세션에서 현재 사용자 ID 가져오기
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
    const { data, error } = await supabase.rpc('delete_user', {
      p_user_id: userId
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
