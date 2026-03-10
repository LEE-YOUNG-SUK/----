import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bAdminOrderDetailPage } from './B2bAdminOrderDetailPage'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const session = await requirePermission('b2b_order_processing', 'read')
  const { id } = await params
  return (
    <NavigationWrapper user={session}>
      <B2bAdminOrderDetailPage session={session} orderId={id} />
    </NavigationWrapper>
  )
}
