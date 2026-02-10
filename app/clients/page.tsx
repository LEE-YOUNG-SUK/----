import { requirePermission, getPermissionFlags } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getClients } from './actions'
import ClientManagement from '@/components/clients/ClientManagement'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const userData = await requirePermission('clients_management', 'read')
  const permissions = getPermissionFlags(userData.role, 'clients_management')

  const clients = await getClients()

  return (
    <>
      <NavigationWrapper user={userData} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <ContentCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">🏢 거래처 관리</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    거래처 정보를 등록하고 관리합니다
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-600">
                    {userData.role === '0000' ? '전체 지점' : userData.branch_name}
                  </div>
                </div>
              </div>
            </ContentCard>

            <ClientManagement
              initialClients={clients}
              userData={userData}
              permissions={permissions}
            />
          </div>
        </div>
      </div>
    </>
  )
}
