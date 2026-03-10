'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { B2B_SETTLEMENT_DIRECTION_LABELS } from '@/types/b2b'
import type { B2bSettlement } from '@/types/b2b'

interface Props {
  settlements: B2bSettlement[]
}

const directionVariant: Record<string, 'default' | 'success' | 'warning'> = {
  receivable: 'success',
  payable: 'warning',
}

const methodLabels: Record<string, string> = {
  bank_transfer: '계좌이체',
  cash: '현금',
  card: '카드',
  check: '수표',
  offset: '상계',
}

export function B2bSettlementList({ settlements }: Props) {
  if (settlements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>정산 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-4">정산 내역이 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>정산 내역 ({settlements.length}건)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>정산번호</TableHead>
              <TableHead>방향</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>정산일</TableHead>
              <TableHead>방법</TableHead>
              <TableHead>참조번호</TableHead>
              <TableHead>처리자</TableHead>
              <TableHead>메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-sm">{s.settlement_number}</TableCell>
                <TableCell>
                  <Badge variant={directionVariant[s.direction] || 'default'}>
                    {B2B_SETTLEMENT_DIRECTION_LABELS[s.direction] || s.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{s.amount.toLocaleString()}원</TableCell>
                <TableCell className="text-sm">
                  {new Date(s.settlement_date).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell className="text-sm">{s.method ? (methodLabels[s.method] || s.method) : '-'}</TableCell>
                <TableCell className="text-sm">{s.reference_number || '-'}</TableCell>
                <TableCell className="text-sm">{s.settled_by_name || '-'}</TableCell>
                <TableCell className="text-sm text-gray-500">{s.memo || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
