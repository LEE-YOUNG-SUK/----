'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { createStatement } from '@/app/b2b-orders/admin/actions'
import type { B2bOrderItemDetail } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  orderId: string
  orderNumber: string
  items: B2bOrderItemDetail[]
  open: boolean
  onClose: () => void
}

export function B2bStatementCreateForm({ orderId, orderNumber, items, open, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    items.forEach(item => {
      initial[item.id] = item.quantity
    })
    return initial
  })
  const [memo, setMemo] = useState('')

  const handleQuantityChange = (itemId: string, value: string, maxQty: number) => {
    const num = parseInt(value, 10)
    setQuantities(prev => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : Math.min(Math.max(0, num), maxQty)
    }))
  }

  const handleFillAll = () => {
    const filled: Record<string, number> = {}
    items.forEach(item => {
      filled[item.id] = item.quantity
    })
    setQuantities(prev => ({ ...prev, ...filled }))
  }

  const handleSubmit = async () => {
    const stmtItems = items
      .filter(item => (quantities[item.id] || 0) > 0)
      .map(item => ({
        order_item_id: item.id,
        quantity: quantities[item.id] || 0,
      }))

    if (stmtItems.length === 0) {
      toast.error('수량이 입력된 항목이 없습니다.')
      return
    }

    setLoading(true)
    try {
      const result = await createStatement(orderId, stmtItems, memo || undefined)
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

  const selectedCount = items.filter(item => (quantities[item.id] || 0) > 0).length

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>거래명세서 생성 - {orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">명세서에 포함할 품목과 수량을 선택하세요</span>
            <Button variant="outline" size="sm" onClick={handleFillAll}>전량 채우기</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">주문수량</TableHead>
                <TableHead className="w-28 text-center">명세서 수량</TableHead>
                <TableHead className="text-right">공급가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const qty = quantities[item.id] || 0
                const supplyPrice = item.unit_price * qty
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-gray-500">{item.product_code} / {item.unit}</div>
                    </TableCell>
                    <TableCell className="text-right">{item.unit_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>
                      <Input
                        inputSize="sm"
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={qty}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value, item.quantity)}
                        className="text-center"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {qty > 0 ? supplyPrice.toLocaleString() : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <Textarea
            label="메모"
            textareaSize="sm"
            placeholder="메모 (선택사항)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <DialogFooter>
          <div className="flex items-center gap-4 w-full justify-between">
            <span className="text-sm text-gray-600">
              선택 품목: <span className="font-bold">{selectedCount}개</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={handleSubmit} disabled={loading || selectedCount === 0}>
                {loading ? '처리 중...' : '초안 생성'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
