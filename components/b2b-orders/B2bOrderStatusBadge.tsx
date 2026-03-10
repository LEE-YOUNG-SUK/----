'use client'

import { Badge } from '@/components/ui/Badge'
import {
  B2B_ORDER_STATUS_LABELS,
  B2B_ORDER_STATUS_COLORS,
  type B2bOrderStatus,
} from '@/types/b2b'

interface Props {
  status: B2bOrderStatus
  className?: string
}

export function B2bOrderStatusBadge({ status, className }: Props) {
  return (
    <Badge variant={B2B_ORDER_STATUS_COLORS[status]} className={className}>
      {B2B_ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}
