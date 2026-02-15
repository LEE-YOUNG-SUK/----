/**
 * 세션 검증 공통 유틸리티
 * 모든 페이지에서 반복되는 세션 검증 로직을 통합
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PermissionChecker } from '@/lib/permissions'
import type { UserData } from '@/types'
import type { PermissionResource, PermissionAction } from '@/types/permissions'

/**
 * 세션 정보 조회 (리다이렉트 없음)
 * @returns UserData | null
 */
export async function getSession(): Promise<UserData | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_session_token')?.value

    if (!token) return null

    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('verify_session', {
      p_token: token
    })

    if (error || !data || data.length === 0 || !data[0].valid) {
      // 세션이 무효하면 쿠키 삭제 (무한 리다이렉트 방지)
      cookieStore.delete('erp_session_token')
      return null
    }

    const session = data[0]

    return {
      user_id: session.user_id,
      username: session.username,
      display_name: session.display_name,
      role: session.role as '0000' | '0001' | '0002' | '0003',
      branch_id: session.branch_id || null,
      branch_name: session.branch_name || null
    }
  } catch {
    return null
  }
}

/**
 * 세션 필수 확인 (없으면 로그인 페이지로 리다이렉트)
 * @returns UserData (항상 유효한 세션 반환)
 */
export async function requireSession(): Promise<UserData> {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }
  return session
}

/**
 * 세션 + 권한 확인 (권한 없으면 홈으로 리다이렉트)
 * @param resource - 확인할 리소스
 * @param action - 확인할 액션
 * @returns UserData (항상 유효한 세션 + 권한 반환)
 */
export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction
): Promise<UserData> {
  const session = await requireSession()
  const permissions = new PermissionChecker(session.role)

  if (!permissions.can(resource, action)) {
    redirect('/')
  }

  return session
}

/**
 * 권한 체크 결과 반환 (리다이렉트 없음)
 */
export function checkPermissions(role: string) {
  return new PermissionChecker(role)
}

/**
 * CRUD 권한 객체 생성
 */
export function getPermissionFlags(role: string, resource: PermissionResource) {
  const permissions = new PermissionChecker(role)
  return {
    canCreate: permissions.can(resource, 'create'),
    canRead: permissions.can(resource, 'read'),
    canUpdate: permissions.can(resource, 'update'),
    canDelete: permissions.can(resource, 'delete')
  }
}
