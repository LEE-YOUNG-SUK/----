import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { B2bOrderDetailPage } from './B2bOrderDetailPage'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const session = await requirePermission('b2b_orders', 'read')
  const { id } = await params
  return (
    <NavigationWrapper user={session}>
      <B2bOrderDetailPage session={session} orderId={id} />
    </NavigationWrapper>
  )
}
