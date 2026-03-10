import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bAdminOrdersPage } from './B2bAdminOrdersPage'

export default async function Page() {
  const session = await requirePermission('b2b_order_processing', 'read')
  return (
    <NavigationWrapper user={session}>
      <B2bAdminOrdersPage session={session} />
    </NavigationWrapper>
  )
}
