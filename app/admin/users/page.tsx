import { requirePermission, getPermissionFlags } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getUsers, getBranches } from './actions'
import UserManagement from '@/components/admin/users/UserManagement'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const userData = await requirePermission('users_management', 'read')
  const permissions = getPermissionFlags(userData.role, 'users_management')

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
                  <p className="text-sm text-gray-900 mt-1">
                    {userData.role === '0001' 
                      ? '본인 지점의 직원을 관리합니다 (매니저, 직원만 생성 가능)'
                      : '시스템 사용자를 등록하고 관리합니다'
                    }
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-900">
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
                permissions={permissions}
              />
            </ContentCard>
          </div>
        </div>
      </div>
    </>
  )
}