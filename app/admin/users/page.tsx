import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { UserData } from '@/types'
import { NavigationWrapper } from '@/components/NavigationWrapper'

async function getSession(): Promise<UserData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session_token')?.value
  if (!token) return null
  
  const supabase = await createServerClient()
  const { data } = await supabase.rpc('verify_session', { p_token: token })
  
  if (!data?.[0]?.valid) return null
  
  const session = data[0]
  return {
    user_id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    role: session.role as '0000' | '0001' | '0002' | '0003',
    branch_id: session.branch_id || null,
    branch_name: session.branch_name || null
  }
}

export default async function PurchasesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationWrapper user={session} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">📥 입고 관리</h1>
          <p className="text-gray-600">Phase 5에서 구현 예정</p>
        </div>
      </main>
    </div>
  )
}