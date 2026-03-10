import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bNewOrderPage } from './B2bNewOrderPage'

export default async function Page() {
  const session = await requirePermission('b2b_orders', 'create')
  return (
    <NavigationWrapper user={session}>
      <B2bNewOrderPage session={session} />
    </NavigationWrapper>
  )
}
