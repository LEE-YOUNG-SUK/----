import { requirePermission, getPermissionFlags } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getClients } from './actions'
import { createServerClient } from '@/lib/supabase/server'
import ClientManagement from '@/components/clients/ClientManagement'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  // 세션 검증 + 데이터 동시 조회
  const [userData, clients] = await Promise.all([
    requirePermission('clients_management', 'read'),
    getClients()
  ])
  const permissions = getPermissionFlags(userData.role, 'clients_management')

  // 본사 관리자: 지점 목록 조회 (거래처 등록 시 지점 선택용)
  let branches: { id: string; name: string }[] = []
  if (userData.is_headquarters && ['0000', '0001'].includes(userData.role)) {
    const supabase = await createServerClient()
    const { data } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
    branches = data || []
  }

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
                  <p className="text-sm text-gray-900 mt-1">
                    거래처 정보를 등록하고 관리합니다
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-900">
                    {userData.is_headquarters && ['0000', '0001'].includes(userData.role) ? '전체 지점' : userData.branch_name}
                  </div>
                </div>
              </div>
            </ContentCard>

            <ClientManagement
              initialClients={clients}
              userData={userData}
              permissions={permissions}
              branches={branches}
            />
          </div>
        </div>
      </div>
    </>
  )
}
