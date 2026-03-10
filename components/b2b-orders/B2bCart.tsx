'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import type { B2bCartItem } from '@/types/b2b'

interface Props {
  items: B2bCartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onUpdateMemo: (productId: string, memo: string) => void
}

export function B2bCart({ items, onUpdateQuantity, onRemoveItem, onUpdateMemo }: Props) {
  const totalSupplyPrice = items.reduce((sum, item) => sum + item.supply_price, 0)
  const totalTaxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.total_price, 0)

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
        장바구니가 비어있습니다. 품목을 선택하여 담아주세요.
      </div>
    )
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>품목</TableHead>
            <TableHead>단위</TableHead>
            <TableHead className="text-right">단가</TableHead>
            <TableHead className="w-24 text-center">수량</TableHead>
            <TableHead className="text-right">공급가</TableHead>
            <TableHead className="text-right">부가세</TableHead>
            <TableHead className="text-right">합계</TableHead>
            <TableHead className="w-32">메모</TableHead>
            <TableHead className="w-16">{' '}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.product_id}>
              <TableCell>
                <div className="font-medium">{item.product_name}</div>
                <div className="text-xs text-gray-500">{item.product_code}</div>
              </TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell className="text-right">{item.unit_price.toLocaleString()}</TableCell>
              <TableCell>
                <Input
                  inputSize="sm"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v > 0) onUpdateQuantity(item.product_id, v)
                  }}
                  className="text-center"
                />
              </TableCell>
              <TableCell className="text-right">{item.supply_price.toLocaleString()}</TableCell>
              <TableCell className="text-right">{item.tax_amount.toLocaleString()}</TableCell>
              <TableCell className="text-right font-medium">{item.total_price.toLocaleString()}</TableCell>
              <TableCell>
                <Input
                  inputSize="sm"
                  placeholder="메모"
                  value={item.memo}
                  onChange={(e) => onUpdateMemo(item.product_id, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveItem(item.product_id)}
                  className="text-red-500 hover:text-red-700"
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 합계 */}
      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">공급가 합계</span>
            <span>{totalSupplyPrice.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">부가세 합계</span>
            <span>{totalTaxAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-base">
            <span>총 합계</span>
            <span>{totalPrice.toLocaleString()}원</span>
          </div>
        </div>
      </div>
    </div>
  )
}
