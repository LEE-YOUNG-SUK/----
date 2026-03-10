'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { B2bProductCatalog } from '@/components/b2b-orders/B2bProductCatalog'
import { B2bCart } from '@/components/b2b-orders/B2bCart'
import { getOrderableProducts, createOrder, createOrderForBranch, submitOrder, getBranchesList } from '../actions'
import { toast } from 'sonner'
import type { UserData } from '@/types'
import type { B2bCartItem } from '@/types/b2b'

interface OrderableProduct {
  product_id: string
  product_code: string
  product_name: string
  category_name: string | null
  unit: string
  b2b_price: number
  standard_sale_price: number | null
}

interface Props {
  session: UserData
}

export function B2bNewOrderPage({ session }: Props) {
  const router = useRouter()
  const isHQ = session.role === '0000'

  const [products, setProducts] = useState<OrderableProduct[]>([])
  const [cartItems, setCartItems] = useState<B2bCartItem[]>([])
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([])

  useEffect(() => {
    async function load() {
      const result = await getOrderableProducts()
      if (result.success) {
        setProducts(result.data as OrderableProduct[])
      } else {
        toast.error(result.message)
      }

      // 본사인 경우 지점 목록도 로드
      if (isHQ) {
        const branchResult = await getBranchesList()
        if (branchResult.success) {
          setBranches(branchResult.data)
        }
      }

      setLoading(false)
    }
    load()
  }, [isHQ])

  const calcPrices = (unitPrice: number, quantity: number) => {
    const supplyPrice = unitPrice * quantity
    const taxAmount = Math.round(supplyPrice * 0.1)
    const totalPrice = supplyPrice + taxAmount
    return { supply_price: supplyPrice, tax_amount: taxAmount, total_price: totalPrice }
  }

  const handleAddToCart = useCallback((product: OrderableProduct, quantity: number) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.product_id)
      if (existing) {
        // 이미 있으면 수량 추가
        const newQty = existing.quantity + quantity
        const prices = calcPrices(existing.unit_price, newQty)
        return prev.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: newQty, ...prices }
            : item
        )
      }
      // 새로 추가
      const prices = calcPrices(product.b2b_price, quantity)
      return [
        ...prev,
        {
          product_id: product.product_id,
          product_code: product.product_code,
          product_name: product.product_name,
          unit: product.unit,
          quantity,
          unit_price: product.b2b_price,
          ...prices,
          memo: '',
        },
      ]
    })
    toast.success(`${product.product_name} ${quantity}${product.unit} 추가`)
  }, [])

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        const prices = calcPrices(item.unit_price, quantity)
        return { ...item, quantity, ...prices }
      })
    )
  }, [])

  const handleRemoveItem = useCallback((productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product_id !== productId))
  }, [])

  const handleUpdateMemo = useCallback((productId: string, memo: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, memo } : item
      )
    )
  }, [])

  const handleSubmit = async (asDraft: boolean) => {
    if (cartItems.length === 0) {
      toast.error('장바구니에 품목을 추가해주세요.')
      return
    }

    if (isHQ && !selectedBranchId) {
      toast.error('지점을 선택해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const items = cartItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

      // 주문 생성
      const createResult = isHQ
        ? await createOrderForBranch(selectedBranchId, items, memo || undefined)
        : await createOrder(items, memo || undefined)

      if (!createResult.success) {
        toast.error(createResult.message)
        setSubmitting(false)
        return
      }

      // 임시저장이 아니면 바로 제출
      if (!asDraft && createResult.data?.order_id) {
        const submitResult = await submitOrder(createResult.data.order_id)
        if (!submitResult.success) {
          toast.error(submitResult.message)
          setSubmitting(false)
          return
        }
        toast.success('주문이 제출되었습니다.')
      } else {
        toast.success('주문이 임시저장되었습니다.')
      }

      router.push('/b2b-orders')
    } catch {
      toast.error('주문 처리 중 오류가 발생했습니다.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">B2B 발주하기</h1>
      </div>

      {/* 본사: 지점 선택 */}
      {isHQ && (
        <ContentCard title="지점 선택">
          <Select
            value={selectedBranchId}
            onValueChange={setSelectedBranchId}
          >
            <option value="">지점을 선택해주세요</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </Select>
        </ContentCard>
      )}

      {/* 품목 카탈로그 */}
      <ContentCard title="품목 선택">
        <B2bProductCatalog products={products} onAddToCart={handleAddToCart} />
      </ContentCard>

      {/* 장바구니 */}
      <ContentCard title={`장바구니 (${cartItems.length}건)`}>
        <B2bCart
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onUpdateMemo={handleUpdateMemo}
        />

        {cartItems.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-900 mb-1">주문 메모</label>
            <Textarea
              value={memo}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMemo(e.target.value)}
              placeholder="주문 관련 메모 (선택사항)"
              rows={2}
            />
          </div>
        )}
      </ContentCard>

      {/* 하단 버튼 */}
      {cartItems.length > 0 && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/b2b-orders')}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(true)}
            loading={submitting}
          >
            임시저장
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            loading={submitting}
          >
            주문 제출
          </Button>
        </div>
      )}
    </div>
  )
}
