import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PermissionChecker } from '@/lib/permissions'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { getClients } from './actions'
import ClientManagement from '@/components/clients/ClientManagement'

export const dynamic = 'force-dynamic'

async function getSession() {
  console.log('🔑 [Clients] getSession 시작')
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value

  if (!token) {
    console.log('❌ [Clients] 토큰 없음')
    redirect('/login')
  }

  console.log('✅ [Clients] 토큰 확인')

  const supabase = await createServerClient()
  const { data: sessionData } = await supabase.rpc('verify_session', { 
    p_token: token 
  })

  if (!sessionData?.[0]?.valid) {
    console.log('❌ [Clients] 세션 무효')
    redirect('/login')
  }

  console.log('✅ [Clients] 세션 유효:', sessionData[0].username)

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

export default async function ClientsPage() {
  const userData = await getSession()
  const permissions = new PermissionChecker(userData.role)

  // 권한 체크
  console.log('🔍 Clients Page - User Role:', userData.role)
  console.log('🔍 Clients Page - Can Read:', permissions.can('clients_management', 'read'))
  
  if (!permissions.can('clients_management', 'read')) {
    console.log('❌ Clients Page - Access Denied, redirecting to /')
    redirect('/')
  }

  console.log('📊 [Clients] 거래처 데이터 조회 시작...')
  const clients = await getClients()
  console.log('📊 [Clients] 조회된 거래처 수:', clients?.length || 0)
  console.log('📊 [Clients] 첫 번째 거래처:', clients?.[0])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={userData} />
      
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">거래처 관리</h1>
          <p className="text-sm text-gray-600 mt-2">
            거래처 정보를 등록하고 관리합니다
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg">
          <ClientManagement 
            initialClients={clients} 
            userData={userData}
            permissions={{
              canCreate: permissions.can('clients_management', 'create'),
              canUpdate: permissions.can('clients_management', 'update'),
              canDelete: permissions.can('clients_management', 'delete')
            }}
          />
        </div>
      </main>
    </div>
  )
}
