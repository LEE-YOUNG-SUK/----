// branches 관리 Server Actions
'use server'
import { createServerClient } from '@/lib/supabase/server'
import type { Branch } from '@/types'
import { revalidatePath } from 'next/cache'

// 지점 목록 조회
export async function getBranchesList() {
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
  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').insert([branch])
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/branches')
  return { success: true }
}

// 지점 수정
export async function updateBranch(id: string, updates: Partial<Branch>) {
  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').update(updates).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/branches')
  return { success: true }
}

// 지점 삭제
export async function deleteBranch(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase.from('branches').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/admin/branches')
  return { success: true }
}
