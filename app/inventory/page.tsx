import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { UserData } from '@/types'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { InventoryStats } from '@/components/inventory/InventoryStats'
import { InventoryTable } from '@/components/inventory/InventoryTable'
import { ContentCard } from '@/components/shared/ContentCard'

interface InventoryItem {
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  category: string | null
  current_quantity: number
  layer_count: number
  oldest_purchase_date: string | null
  newest_purchase_date: string | null
  avg_unit_cost: number | null
  min_stock_level?: number
}

interface InventorySummary {
  total_products: number
  total_quantity: number
  total_value: number
  low_stock_count: number
  out_of_stock_count: number
}

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

export default async function InventoryPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  // 원장/매니저/사용자는 본인 지점만
  const branchFilter = ['0001', '0002', '0003'].includes(session.role)
    ? session.branch_id
    : null
  
  const supabase = await createServerClient()
  
  // 재고 현황 조회
  const { data: inventory, error: invError } = await supabase.rpc('get_current_inventory', {
    p_branch_id: branchFilter
  })
  
  // 재고 요약 통계
  const { data: summary, error: sumError } = await supabase.rpc('get_inventory_summary', {
    p_branch_id: branchFilter
  })
  
  if (invError) {
    console.error('❌ 재고 조회 실패:', invError)
  }
  
  if (sumError) {
    console.error('❌ 요약 통계 실패:', sumError)
  }
  
  const inventoryData = (inventory as InventoryItem[]) || []
  const summaryData = (summary as InventorySummary[]) || []
  
  return (
    <>
      <NavigationWrapper user={session} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <ContentCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">📦 재고 현황</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    실시간 재고 조회 및 FIFO 레이어 분석
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-600">
                    {session.role === '0000' ? '전체 지점' : session.branch_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date().toLocaleString('ko-KR')}
                  </div>
                </div>
              </div>
            </ContentCard>
            
            {/* 요약 통계 */}
            <InventoryStats summary={summaryData[0] || null} />
            
            {/* 재고 테이블 */}
            {invError ? (
              <ContentCard className="bg-red-50 border-red-200">
                <p className="text-red-800">
                  {'❌ 재고 데이터를 불러오는데 실패했습니다: '}{invError.message}
                </p>
              </ContentCard>
            ) : (
              <InventoryTable
                initialData={inventoryData}
                userRole={session.role}
                branchId={session.branch_id}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}