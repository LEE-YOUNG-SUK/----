import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import InventoryStatusClient from '@/components/Inventory/InventoryStatusClient'
import { getProductsList } from '@/app/inventory-adjustments/actions'
import { getBranchesList } from '@/app/inventory/actions'

export default async function InventoryPage() {
  const session = await requireSession()

  // 품목 목록 + 지점 목록 병렬 조회
  const [productsResult, branches] = await Promise.all([
    getProductsList(),
    getBranchesList(),
  ])
  const products = productsResult.success
    ? JSON.parse(JSON.stringify(productsResult.data))
    : []

  return (
    <>
      <NavigationWrapper user={session} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <InventoryStatusClient
              userSession={session}
              products={products}
              branches={JSON.parse(JSON.stringify(branches))}
            />
          </div>
        </div>
      </div>
    </>
  )
}
