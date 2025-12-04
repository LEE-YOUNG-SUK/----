'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveInventoryAdjustment, getCurrentStock } from '@/app/inventory-adjustments/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FormGrid } from '@/components/shared/FormGrid'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import type { Product } from '@/types'
import type { 
  AdjustmentType, 
  AdjustmentReason,
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_TYPE_LABELS
} from '@/types/inventory-adjustment'

interface SessionData {
  user_id: string
  branch_id: string
  branch_name: string
  role: string
}

interface Props {
  products: Product[]
  session: SessionData
}

export default function AdjustmentForm({ products, session }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentStock, setCurrentStock] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])

  const [formData, setFormData] = useState({
    adjustment_type: 'INCREASE' as AdjustmentType,
    adjustment_reason: 'STOCK_COUNT' as AdjustmentReason,
    quantity: 0,
    unit_cost: 0,
    supply_price: 0,
    tax_amount: 0,
    total_cost: 0,
    notes: '',
    reference_number: '',
    adjustment_date: new Date().toISOString().split('T')[0]
  })

  // 품목 검색 필터링
  useEffect(() => {
    if (searchQuery.length >= 1) {
      const search = searchQuery.toLowerCase()
      const filtered = products.filter(
        (p) =>
          p.code.toLowerCase().includes(search) ||
          p.name.toLowerCase().includes(search)
      )
      setFilteredProducts(filtered.slice(0, 10))
      setShowDropdown(filtered.length > 0)
    } else {
      setFilteredProducts([])
      setShowDropdown(false)
    }
  }, [searchQuery, products])

  // 품목 선택 시 현재 재고 조회
  useEffect(() => {
    if (selectedProduct) {
      getCurrentStock(session.branch_id, selectedProduct.id).then(setCurrentStock)
    }
  }, [selectedProduct, session.branch_id])

  // 원가 입력 시 공급가/세액/합계 자동 계산 (INCREASE인 경우)
  useEffect(() => {
    if (formData.adjustment_type === 'INCREASE' && formData.quantity > 0 && formData.unit_cost > 0) {
      const supply = Math.round(formData.unit_cost / 1.1)
      const tax = formData.unit_cost - supply
      const total = formData.unit_cost * formData.quantity
      
      setFormData(prev => ({
        ...prev,
        supply_price: supply,
        tax_amount: tax,
        total_cost: total
      }))
    }
  }, [formData.adjustment_type, formData.quantity, formData.unit_cost])

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setSearchQuery(`${product.code} - ${product.name}`)
    setShowDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 검증
    if (!selectedProduct) {
      alert('품목을 선택해주세요.')
      return
    }

    if (formData.quantity <= 0) {
      alert('수량은 0보다 커야 합니다.')
      return
    }

    if (formData.adjustment_type === 'INCREASE' && formData.unit_cost <= 0) {
      alert('재고 증가 시 단위 원가는 필수입니다.')
      return
    }

    if (formData.adjustment_type === 'DECREASE' && formData.quantity > currentStock) {
      alert(`재고 부족: 현재 재고 ${currentStock}, 차감 요청 ${formData.quantity}`)
      return
    }

    const reasonLabels: Record<AdjustmentReason, string> = {
      STOCK_COUNT: '실사',
      DAMAGE: '불량',
      LOSS: '분실',
      RETURN: '반품',
      OTHER: '기타'
    }

    const typeLabels: Record<AdjustmentType, string> = {
      INCREASE: '증가',
      DECREASE: '감소'
    }

    const confirmed = confirm(
      `재고 조정을 진행하시겠습니까?\n\n` +
      `품목: ${selectedProduct.name}\n` +
      `유형: ${typeLabels[formData.adjustment_type]}\n` +
      `사유: ${reasonLabels[formData.adjustment_reason]}\n` +
      `수량: ${formData.quantity} ${selectedProduct.unit}\n` +
      `${formData.adjustment_type === 'INCREASE' ? `단위 원가: ₩${formData.unit_cost.toLocaleString()}` : ''}`
    )

    if (!confirmed) return

    setIsSubmitting(true)

    try {
      const result = await saveInventoryAdjustment({
        branch_id: session.branch_id,
        product_id: selectedProduct.id,
        adjustment_type: formData.adjustment_type,
        adjustment_reason: formData.adjustment_reason,
        quantity: formData.quantity,
        unit_cost: formData.adjustment_type === 'INCREASE' ? formData.unit_cost : null,
        supply_price: formData.adjustment_type === 'INCREASE' ? formData.supply_price : null,
        tax_amount: formData.adjustment_type === 'INCREASE' ? formData.tax_amount : null,
        total_cost: formData.adjustment_type === 'INCREASE' ? formData.total_cost : null,
        notes: formData.notes || undefined,
        reference_number: formData.reference_number || undefined,
        adjustment_date: formData.adjustment_date,
        user_id: session.user_id,
        user_role: session.role,
        user_branch_id: session.branch_id
      })

      if (result.success) {
        alert(result.message || '재고 조정이 완료되었습니다.')
        // 폼 리셋
        setSelectedProduct(null)
        setSearchQuery('')
        setCurrentStock(0)
        setFormData({
          adjustment_type: 'INCREASE',
          adjustment_reason: 'STOCK_COUNT',
          quantity: 0,
          unit_cost: 0,
          supply_price: 0,
          tax_amount: 0,
          total_cost: 0,
          notes: '',
          reference_number: '',
          adjustment_date: new Date().toISOString().split('T')[0]
        })
        router.refresh()
      } else {
        alert(result.message || '재고 조정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Adjustment error:', error)
      alert('재고 조정 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const reasonLabels: Record<AdjustmentReason, string> = {
    STOCK_COUNT: '실사',
    DAMAGE: '불량',
    LOSS: '분실',
    RETURN: '반품',
    OTHER: '기타'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 품목 검색 */}
      <div className="space-y-2">
        <Label htmlFor="product">품목 검색 *</Label>
        <div className="relative">
          <Input
            id="product"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery && setShowDropdown(true)}
            placeholder="품목 코드 또는 품명 입력..."
            className="w-full"
          />
          
          {showDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductSelect(product)}
                  className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <div className="font-medium">{product.code}</div>
                  <div className="text-sm text-gray-600">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.category} | {product.unit}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {selectedProduct && (
          <div className="text-sm bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="font-medium">{selectedProduct.code} - {selectedProduct.name}</div>
            <div className="text-gray-600 mt-1">
              현재 재고: <span className="font-semibold text-blue-600">{currentStock} {selectedProduct.unit}</span>
            </div>
          </div>
        )}
      </div>

      {/* 조정 유형 */}
      <div className="space-y-2">
        <Label>조정 유형 *</Label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="adjustment_type"
              value="INCREASE"
              checked={formData.adjustment_type === 'INCREASE'}
              onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value as AdjustmentType })}
              className="mr-2"
            />
            <span className="text-green-600 font-medium">➕ 증가</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="adjustment_type"
              value="DECREASE"
              checked={formData.adjustment_type === 'DECREASE'}
              onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value as AdjustmentType })}
              className="mr-2"
            />
            <span className="text-red-600 font-medium">➖ 감소</span>
          </label>
        </div>
      </div>

      {/* 조정 사유 */}
      <div className="space-y-2">
        <Label htmlFor="reason">조정 사유 *</Label>
        <select
          id="reason"
          value={formData.adjustment_reason}
          onChange={(e) => setFormData({ ...formData, adjustment_reason: e.target.value as AdjustmentReason })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          {Object.entries(reasonLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <FormGrid columns={2}>
        {/* 수량 */}
        <div className="space-y-2">
          <Label htmlFor="quantity">수량 *</Label>
          <Input
            id="quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
            min="0"
            step="1"
            required
          />
        </div>

        {/* 단위 원가 (INCREASE인 경우만) */}
        {formData.adjustment_type === 'INCREASE' && (
          <div className="space-y-2">
            <Label htmlFor="unit_cost">단위 원가 (부가세 포함) *</Label>
            <Input
              id="unit_cost"
              type="number"
              value={formData.unit_cost}
              onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })}
              min="0"
              step="1"
              required
            />
          </div>
        )}

        {/* 조정일 */}
        <div className="space-y-2">
          <Label htmlFor="adjustment_date">조정일 *</Label>
          <Input
            id="adjustment_date"
            type="date"
            value={formData.adjustment_date}
            onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
            required
          />
        </div>

        {/* 참조 번호 */}
        <div className="space-y-2">
          <Label htmlFor="reference_number">참조 번호</Label>
          <Input
            id="reference_number"
            value={formData.reference_number}
            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            placeholder="예: INV-2025-001"
          />
        </div>
      </FormGrid>

      {/* 금액 정보 (INCREASE인 경우만) */}
      {formData.adjustment_type === 'INCREASE' && formData.total_cost > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2">
          <div className="text-sm font-medium text-gray-700">금액 정보 (자동 계산)</div>
          <FormGrid columns={3}>
            <div>
              <div className="text-gray-600">공급가</div>
              <div className="font-semibold">₩{formData.supply_price.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600">부가세</div>
              <div className="font-semibold">₩{formData.tax_amount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600">합계</div>
              <div className="font-semibold text-blue-600">₩{formData.total_cost.toLocaleString()}</div>
            </div>
          </FormGrid>
        </div>
      )}

      {/* 비고 */}
      <div className="space-y-2">
        <Label htmlFor="notes">비고</Label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="조정 사유 상세 설명..."
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3">
        <PrimaryButton
          type="submit"
          disabled={isSubmitting || !selectedProduct}
          loading={isSubmitting}
        >
          재고 조정
        </PrimaryButton>
      </div>
    </form>
  )
}
