'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { B2bShipment } from '@/types/b2b'

interface Props {
  shipments: B2bShipment[]
  onConfirmReceipt?: (shipmentId: string) => void
  confirmLoading?: string | null // 수령확인 중인 shipmentId
}

export function B2bShipmentList({ shipments, onConfirmReceipt, confirmLoading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (shipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>출고 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-4">출고 내역이 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>출고 내역 ({shipments.length}건)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>출고번호</TableHead>
              <TableHead>출고일</TableHead>
              <TableHead>택배사</TableHead>
              <TableHead>운송장</TableHead>
              <TableHead>출고자</TableHead>
              <TableHead>수령확인</TableHead>
              <TableHead className="w-28">{' '}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((shipment) => (
              <>
                <TableRow key={shipment.id}>
                  <TableCell className="font-medium text-sm">{shipment.shipment_number}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(shipment.shipped_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-sm">{shipment.courier || '-'}</TableCell>
                  <TableCell className="text-sm">{shipment.tracking_number || '-'}</TableCell>
                  <TableCell className="text-sm">{shipment.shipped_by_name || '-'}</TableCell>
                  <TableCell>
                    {shipment.receipt_confirmed ? (
                      <Badge variant="success">
                        수령완료
                      </Badge>
                    ) : onConfirmReceipt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onConfirmReceipt(shipment.id)}
                        disabled={confirmLoading === shipment.id}
                      >
                        {confirmLoading === shipment.id ? '처리중...' : '수령확인'}
                      </Button>
                    ) : (
                      <Badge variant="warning">미확인</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === shipment.id ? null : shipment.id)}
                    >
                      {expandedId === shipment.id ? '접기' : '상세'}
                    </Button>
                  </TableCell>
                </TableRow>

                {/* 확장 상세 */}
                {expandedId === shipment.id && shipment.items && (
                  <tr key={`${shipment.id}-detail`}>
                    <td colSpan={7} className="bg-gray-50 p-4">
                      <div className="space-y-2">
                        {/* 출고 품목 */}
                        <div className="text-sm font-medium text-gray-700 mb-2">출고 품목</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">품목</th>
                              <th className="text-right py-1">출고수량</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shipment.items.map((item) => (
                              <tr key={item.id} className="border-t border-gray-200">
                                <td className="py-1">
                                  {item.product_name}
                                  <span className="text-gray-400 ml-1">({item.product_code})</span>
                                </td>
                                <td className="text-right py-1 font-medium">{item.quantity} {item.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* 메모 / 수령확인 정보 */}
                        {shipment.memo && (
                          <div className="text-sm text-gray-600 mt-2">
                            <span className="text-gray-500">메모: </span>{shipment.memo}
                          </div>
                        )}
                        {shipment.receipt_confirmed && (
                          <div className="text-sm text-green-600 mt-1">
                            수령확인: {shipment.receipt_confirmed_by_name} ({new Date(shipment.receipt_confirmed_at!).toLocaleString('ko-KR')})
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
