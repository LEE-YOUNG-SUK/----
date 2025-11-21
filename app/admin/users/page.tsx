import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PermissionChecker } from '@/lib/permissions'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getUsers, getBranches } from './actions'
import UserManagement from '@/components/admin/users/UserManagement'

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
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={userData} />
      
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
          <p className="text-sm text-gray-600 mt-2">
            시스템 사용자를 등록하고 관리합니다
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg">
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
        </div>
      </main>
    </div>
  )
}