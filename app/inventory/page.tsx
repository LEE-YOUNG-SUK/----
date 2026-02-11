import { requireSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { InventoryStats } from '@/components/Inventory/InventoryStats'
import { InventoryTable } from '@/components/Inventory/InventoryTable'
import { ContentCard } from '@/components/ui/Card'

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

export default async function InventoryPage() {
  const session = await requireSession()
  
  // 원장/매니저/사용자는 본인 지점만
  const branchFilter = ['0001', '0002', '0003'].includes(session.role)
    ? session.branch_id
    : null
  
  const supabase = await createServerClient()
  
  // 재고 현황 + 요약 통계 병렬 조회
  const [{ data: inventory, error: invError }, { data: summary, error: sumError }] = await Promise.all([
    supabase.rpc('get_current_inventory', { p_branch_id: branchFilter }),
    supabase.rpc('get_inventory_summary', { p_branch_id: branchFilter })
  ])
  
  // 에러는 UI에서 처리
  
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