import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bOrdersPage } from './B2bOrdersPage'

export default async function Page() {
  const session = await requirePermission('b2b_orders', 'read')
  return (
    <NavigationWrapper user={session}>
      <B2bOrdersPage session={session} />
    </NavigationWrapper>
  )
}
