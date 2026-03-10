'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { createShipment } from '@/app/b2b-orders/admin/actions'
import type { B2bOrderItemDetail } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  orderId: string
  orderNumber: string
  items: B2bOrderItemDetail[]
  open: boolean
  onClose: () => void
}

export function B2bShipmentForm({ orderId, orderNumber, items, open, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    items.forEach(item => {
      initial[item.id] = item.remaining_quantity
    })
    return initial
  })
  const [courier, setCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [memo, setMemo] = useState('')

  // 출고 가능한 항목만 (잔여수량 > 0)
  const shippableItems = items.filter(item => item.remaining_quantity > 0)

  const handleQuantityChange = (itemId: string, value: string, maxQty: number) => {
    const num = parseInt(value, 10)
    setQuantities(prev => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : Math.min(Math.max(0, num), maxQty)
    }))
  }

  const handleFillAll = () => {
    const filled: Record<string, number> = {}
    shippableItems.forEach(item => {
      filled[item.id] = item.remaining_quantity
    })
    setQuantities(prev => ({ ...prev, ...filled }))
  }

  const handleClearAll = () => {
    const cleared: Record<string, number> = {}
    shippableItems.forEach(item => {
      cleared[item.id] = 0
    })
    setQuantities(prev => ({ ...prev, ...cleared }))
  }

  const handleSubmit = async () => {
    const shipmentItems = shippableItems
      .filter(item => (quantities[item.id] || 0) > 0)
      .map(item => ({
        order_item_id: item.id,
        quantity: quantities[item.id] || 0,
      }))

    if (shipmentItems.length === 0) {
      toast.error('출고할 수량을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const result = await createShipment(
        orderId,
        shipmentItems,
        courier || undefined,
        trackingNumber || undefined,
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

  const totalShipping = shippableItems.reduce((sum, item) => sum + (quantities[item.id] || 0), 0)

  if (shippableItems.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출고 처리 - {orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-gray-500">
            출고 가능한 항목이 없습니다. 모든 품목이 이미 출고 완료되었습니다.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>출고 처리 - {orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 출고 수량 테이블 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">출고할 수량을 입력하세요</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleFillAll}>전량 채우기</Button>
              <Button variant="ghost" size="sm" onClick={handleClearAll}>초기화</Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead className="text-right">주문수량</TableHead>
                <TableHead className="text-right">기출고</TableHead>
                <TableHead className="text-right">잔여</TableHead>
                <TableHead className="w-28 text-center">출고수량</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shippableItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-xs text-gray-500">{item.product_code} / {item.unit}</div>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.shipped_quantity}</TableCell>
                  <TableCell className="text-right font-medium text-orange-600">
                    {item.remaining_quantity}
                  </TableCell>
                  <TableCell>
                    <Input
                      inputSize="sm"
                      type="number"
                      min={0}
                      max={item.remaining_quantity}
                      value={quantities[item.id] || 0}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value, item.remaining_quantity)}
                      className="text-center"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 배송 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="택배사"
              inputSize="sm"
              placeholder="택배사 (선택사항)"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
            />
            <Input
              label="운송장번호"
              inputSize="sm"
              placeholder="운송장번호 (선택사항)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>

          <Textarea
            label="메모"
            textareaSize="sm"
            placeholder="출고 메모 (선택사항)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <DialogFooter>
          <div className="flex items-center gap-4 w-full justify-between">
            <span className="text-sm text-gray-600">
              출고 예정: <span className="font-bold">{totalShipping}개</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={handleSubmit} disabled={loading || totalShipping === 0}>
                {loading ? '처리 중...' : '출고 처리'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
