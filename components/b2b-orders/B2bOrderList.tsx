'use client'

import Link from 'next/link'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { B2bOrderStatusBadge } from './B2bOrderStatusBadge'
import { B2bProgressBar } from './B2bProgressBar'
import type { B2bOrder } from '@/types/b2b'

interface Props {
  orders: B2bOrder[]
  basePath?: string
  showBranch?: boolean
}

export function B2bOrderList({ orders, basePath = '/b2b-orders', showBranch = false }: Props) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        주문 내역이 없습니다.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>주문번호</TableHead>
          {showBranch && <TableHead>지점</TableHead>}
          <TableHead>상태</TableHead>
          <TableHead className="text-right">공급가</TableHead>
          <TableHead className="text-right">부가세</TableHead>
          <TableHead className="text-right">합계</TableHead>
          <TableHead>출고</TableHead>
          <TableHead>정산</TableHead>
          <TableHead>주문일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <Link
                href={`${basePath}/${order.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {order.order_number}
              </Link>
              {order.item_count != null && (
                <span className="ml-1 text-xs text-gray-500">({order.item_count}건)</span>
              )}
            </TableCell>
            {showBranch && (
              <TableCell>{order.branch_name || '-'}</TableCell>
            )}
            <TableCell>
              <B2bOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="text-right">
              {order.total_supply_price.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              {order.total_tax_amount.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-medium">
              {order.total_price.toLocaleString()}
            </TableCell>
            <TableCell className="w-24">
              <B2bProgressBar value={order.shipping_progress} />
            </TableCell>
            <TableCell className="w-24">
              <B2bProgressBar value={order.settlement_progress} />
            </TableCell>
            <TableCell className="text-sm text-gray-600">
              {new Date(order.created_at).toLocaleDateString('ko-KR')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
