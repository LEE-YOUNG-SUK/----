'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { createSettlement } from '@/app/b2b-orders/admin/actions'
import { B2B_SETTLEMENT_DIRECTION_LABELS } from '@/types/b2b'
import type { B2bSettlementSummary, B2bSettlementDirection } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  orderId: string
  orderNumber: string
  summary: B2bSettlementSummary
  open: boolean
  onClose: () => void
}

const methodOptions = [
  { value: 'bank_transfer', label: '계좌이체' },
  { value: 'cash', label: '현금' },
  { value: 'card', label: '카드' },
  { value: 'check', label: '수표' },
  { value: 'offset', label: '상계' },
]

export function B2bSettlementForm({ orderId, orderNumber, summary, open, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState<string>(summary.remaining.toString())
  const [direction, setDirection] = useState<B2bSettlementDirection>('receivable')
  const [method, setMethod] = useState('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [memo, setMemo] = useState('')

  const handleFillRemaining = () => {
    setAmount(summary.remaining.toString())
  }

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('정산 금액을 올바르게 입력해주세요.')
      return
    }

    if (numAmount > summary.remaining) {
      toast.error(`미정산 금액(${summary.remaining.toLocaleString()}원)을 초과할 수 없습니다.`)
      return
    }

    setLoading(true)
    try {
      const result = await createSettlement(
        orderId,
        numAmount,
        direction,
        method || undefined,
        referenceNumber || undefined,
        undefined, // statementId
        memo || undefined
      )
      if (result.success) {
        toast.success(result.message)
        onClose()
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>정산 처리 - {orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 정산 현황 요약 */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">총 주문금액</span>
              <span className="font-medium">{summary.total_price.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">기 정산</span>
              <span className="font-medium text-green-600">{summary.total_settled.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-gray-500 font-medium">미정산</span>
              <span className="font-bold text-red-600">{summary.remaining.toLocaleString()}원</span>
            </div>
          </div>

          {/* 정산 금액 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">정산 금액</label>
              <Button variant="outline" size="sm" onClick={handleFillRemaining}>
                잔액 전체
              </Button>
            </div>
            <Input
              type="number"
              inputSize="sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              max={summary.remaining}
              placeholder="정산 금액"
            />
          </div>

          {/* 정산 방향 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">정산 방향</label>
            <div className="flex gap-2">
              {(['receivable', 'payable'] as B2bSettlementDirection[]).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={direction === d ? 'default' : 'outline'}
                  onClick={() => setDirection(d)}
                >
                  {B2B_SETTLEMENT_DIRECTION_LABELS[d]}
                </Button>
              ))}
            </div>
          </div>

          {/* 정산 방법 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">정산 방법</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {methodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 참조번호 */}
          <Input
            label="참조번호"
            inputSize="sm"
            placeholder="입금확인 번호, 전표번호 등 (선택)"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />

          {/* 메모 */}
          <Textarea
            label="메모"
            textareaSize="sm"
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '처리 중...' : '정산 처리'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
