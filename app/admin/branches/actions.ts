// branches 관리 Server Actions
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { Branch } from '@/types'
import { revalidatePath } from 'next/cache'

// 지점 목록 조회
export async function getBranchesList() {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.', data: [] }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('code', { ascending: true })
  if (error) return { success: false, message: error.message, data: [] }
  return { success: true, data }
}

// 지점 추가
export async function createBranch(branch: Omit<Branch, 'id' | 'created_at' | 'updated_at'>) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '지점 관리 권한이 없습니다.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').insert([branch])
  if (error) {
    if (error.code === '23505') return { success: false, message: '이미 존재하는 지점 코드입니다.' }
    return { success: false, message: error.message }
  }
  revalidatePath('/admin/branches')
  return { success: true }
}

// 지점 수정
export async function updateBranch(id: string, updates: Partial<Branch>) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '지점 관리 권한이 없습니다.' }

  // 보호 필드 제거
  const { id: _id, created_at: _ca, ...safeUpdates } = updates as any
  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').update({ ...safeUpdates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/branches')
  return { success: true }
}

// 지점 삭제
export async function deleteBranch(id: string) {
  const session = await getSession()
  if (!session) return { success: false, message: '로그인이 필요합니다.' }
  if (session.role !== '0000') return { success: false, message: '지점 관리 권한이 없습니다.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') return { success: false, message: '사용 중인 지점은 삭제할 수 없습니다. (연관 데이터 존재)' }
    return { success: false, message: error.message }
  }
  revalidatePath('/admin/branches')
  return { success: true }
}
