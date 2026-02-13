import { Suspense } from 'react'
import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import MovementDetailClient from '@/components/Inventory/MovementDetailClient'
import { getProductsList } from '@/app/inventory-adjustments/actions'
import { getBranches } from './actions'

export default async function MovementDetailPage() {
  const session = await requireSession()

  const [productsResult, branchesResult] = await Promise.all([
    getProductsList(),
    getBranches(),
  ])

  const products = productsResult.success
    ? JSON.parse(JSON.stringify(productsResult.data))
    : []

  const branches = branchesResult.success
    ? JSON.parse(JSON.stringify(branchesResult.data))
    : []

  return (
    <>
      <NavigationWrapper user={session} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Suspense>
              <MovementDetailClient
                userSession={session}
                products={products}
                branches={branches}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
