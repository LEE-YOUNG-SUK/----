import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PermissionChecker } from '@/lib/permissions'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getUsers, getBranches } from './actions'
import UserManagement from '@/components/admin/users/UserManagement'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: sessionData } = await supabase.rpc('verify_session', { 
    p_token: token 
  })

  if (!sessionData?.[0]?.valid) {
    redirect('/login')
  }

  const session = sessionData[0]

  return {
    user_id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    role: session.role as '0000' | '0001' | '0002' | '0003',
    branch_id: session.branch_id || null,
    branch_name: session.branch_name || null
  }
}

export default async function UsersPage() {
  const userData = await getSession()
  const permissions = new PermissionChecker(userData.role)

  if (!permissions.can('users_management', 'read')) {
    redirect('/')
  }

  const users = await getUsers()
  const branches = await getBranches()

  return (
    <>
      <NavigationWrapper user={userData} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <ContentCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">👥 사용자 관리</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {userData.role === '0001' 
                      ? '본인 지점의 직원을 관리합니다 (매니저, 직원만 생성 가능)'
                      : '시스템 사용자를 등록하고 관리합니다'
                    }
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-600">
                    {userData.role === '0000' ? '시스템 관리자' : userData.branch_name}
                  </div>
                  {userData.role === '0001' && (
                    <div className="text-xs text-blue-600 mt-1">
                      📍 {userData.branch_name} 전용
                    </div>
                  )}
                </div>
              </div>
            </ContentCard>

            <ContentCard>
              <UserManagement 
                initialUsers={users} 
                branches={branches}
                currentUser={userData}
                permissions={{
                  canCreate: permissions.can('users_management', 'create'),
                  canUpdate: permissions.can('users_management', 'update'),
                  canDelete: permissions.can('users_management', 'delete')
                }}
              />
            </ContentCard>
          </div>
        </div>
      </div>
    </>
  )
}