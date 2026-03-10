'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { B2bProgressBar } from '@/components/b2b-orders/B2bProgressBar'
import type { B2bSettlementSummary } from '@/types/b2b'

interface Props {
  summary: B2bSettlementSummary
}

export function B2bSettlementSummaryCard({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>정산 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">총 주문금액</div>
              <div className="text-lg font-bold">{summary.total_price.toLocaleString()}원</div>
            </div>
            <div>
              <div className="text-gray-500">정산 완료</div>
              <div className="text-lg font-bold text-green-600">{summary.total_settled.toLocaleString()}원</div>
            </div>
            <div>
              <div className="text-gray-500">미정산</div>
              <div className="text-lg font-bold text-red-600">{summary.remaining.toLocaleString()}원</div>
            </div>
          </div>
          <B2bProgressBar
            value={summary.settlement_progress}
            label="정산"
          />
        </div>
      </CardContent>
    </Card>
  )
}
