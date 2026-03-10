'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { B2bOrderStatusBadge } from './B2bOrderStatusBadge'
import { B2bProgressBar } from './B2bProgressBar'
import type { B2bOrderDetail as B2bOrderDetailType, B2bOrderItemDetail } from '@/types/b2b'

interface Props {
  detail: B2bOrderDetailType
}

export function B2bOrderDetailView({ detail }: Props) {
  const { order, branch, ordered_by, items, status_history } = detail

  return (
    <div className="space-y-6">
      {/* 주문 요약 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{order.order_number}</CardTitle>
            <B2bOrderStatusBadge status={order.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">지점</span>
              <p className="font-medium">{branch.name}</p>
            </div>
            <div>
              <span className="text-gray-500">주문자</span>
              <p className="font-medium">{ordered_by.display_name}</p>
            </div>
            <div>
              <span className="text-gray-500">주문일</span>
              <p className="font-medium">{new Date(order.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
            <div>
              <span className="text-gray-500">합계금액</span>
              <p className="font-bold text-lg">{order.total_price.toLocaleString()}원</p>
            </div>
          </div>

          {/* 금액 상세 */}
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">공급가: </span>
              <span>{order.total_supply_price.toLocaleString()}원</span>
            </div>
            <div>
              <span className="text-gray-500">부가세: </span>
              <span>{order.total_tax_amount.toLocaleString()}원</span>
            </div>
          </div>

          {/* 진행률 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <B2bProgressBar value={order.shipping_progress} label="출고 진행률" />
            <B2bProgressBar value={order.settlement_progress} label="정산 진행률" />
          </div>

          {/* 메모 */}
          {order.memo && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500">메모: </span>
              {order.memo}
            </div>
          )}

          {/* 취소 사유 */}
          {order.cancel_reason && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <span className="font-medium">취소 사유: </span>
              {order.cancel_reason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 주문 품목 */}
      <Card>
        <CardHeader>
          <CardTitle>주문 품목</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>코드</TableHead>
                <TableHead>품목명</TableHead>
                <TableHead>단위</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">공급가</TableHead>
                <TableHead className="text-right">부가세</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead className="text-right">출고수량</TableHead>
                <TableHead className="text-right">잔여수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: B2bOrderItemDetail) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-gray-600">{item.product_code}</TableCell>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.unit_price.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.supply_price.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{item.tax_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{item.total_price.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{item.shipped_quantity}</TableCell>
                  <TableCell className="text-right">
                    {item.remaining_quantity > 0 ? (
                      <span className="text-orange-600 font-medium">{item.remaining_quantity}</span>
                    ) : (
                      <span className="text-green-600">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 상태 이력 */}
      <Card>
        <CardHeader>
          <CardTitle>상태 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {status_history.length === 0 ? (
            <p className="text-gray-500 text-sm">이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {status_history.map((h, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <div className="text-gray-400 min-w-[120px]">
                    {new Date(h.created_at).toLocaleString('ko-KR')}
                  </div>
                  <div>
                    {h.from_status && (
                      <B2bOrderStatusBadge status={h.from_status} className="mr-1" />
                    )}
                    <span className="text-gray-400 mx-1">&rarr;</span>
                    <B2bOrderStatusBadge status={h.to_status} />
                    <span className="ml-2 text-gray-600">{h.changed_by_name}</span>
                    {h.reason && (
                      <span className="ml-2 text-gray-500">({h.reason})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
