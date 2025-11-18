// app/sales/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import SaleForm from '@/components/sales/sale-form'
import { getCustomersList, getBranchesList } from './actions'

export default async function SalesPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('erp_session_token')?.value

  if (!sessionToken) {
    redirect('/login')
  }

  const supabase = await createServerClient()

  // 세션 검증
  const { data: sessionData, error: sessionError } = await supabase.rpc('verify_session', {
    p_token: sessionToken
  })

  if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].valid) {
    redirect('/login')
  }

  const session = sessionData[0]

  // 컨텍스트 설정
  await supabase.rpc('set_current_user_context', {
    p_user_id: session.user_id,
    p_role: session.role,
    p_branch_id: session.branch_id
  })

  // 사용자 정보 조회
  const { data: userData } = await supabase
    .from('users')
    .select('id, username, display_name, role, branch_id')
    .eq('id', session.user_id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // UserData 형식으로 변환
  const user = {
    user_id: userData.id,
    username: userData.username,
    display_name: userData.display_name,
    role: userData.role,
    branch_id: userData.branch_id,
    branch_name: session.branch_name
  }

  // 고객 목록 조회
  const customersResult = await getCustomersList()
  const customers = customersResult.success ? customersResult.data : []

  // 지점 목록 조회 (시스템 관리자만)
  let branches = undefined
  if (userData.role === '0000') {
    const branchesResult = await getBranchesList()
    branches = branchesResult.success ? branchesResult.data : []
  }

  // JSON 직렬화
  const serializedUser = JSON.parse(JSON.stringify(userData))
  const serializedCustomers = JSON.parse(JSON.stringify(customers))
  const serializedBranches = branches ? JSON.parse(JSON.stringify(branches)) : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={user} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">판매 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            품목을 판매하고 FIFO 원가가 자동으로 계산됩니다
          </p>
        </div>

        <SaleForm 
          user={serializedUser} 
          customers={serializedCustomers}
          branches={serializedBranches}
        />
      </main>
    </div>
  )
}