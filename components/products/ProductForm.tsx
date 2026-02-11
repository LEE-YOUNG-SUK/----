'use client'

import { useState, useEffect } from 'react'
import type { Product, ProductCategory } from '@/types'
import { saveProduct, getProductCategories } from '@/app/products/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Checkbox } from '../ui/Checkbox'
import { FormGrid } from '@/components/shared/FormGrid'

interface ProductFormProps {
  product: Product | null
  onClose: () => void
  onSuccess: () => void
  userId?: string
}

export default function ProductForm({ product, onClose, onSuccess, userId }: ProductFormProps) {
  const isEdit = !!product
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  
  const [formData, setFormData] = useState({
    code: product?.code || '',
    name: product?.name || '',
    category_id: product?.category_id || '',
    unit: product?.unit || '',
    specification: product?.specification || '',
    manufacturer: product?.manufacturer || '',
    barcode: product?.barcode || '',
    min_stock_level: product?.min_stock_level || 0,
    standard_purchase_price: product?.standard_purchase_price || 0,
    standard_sale_price: product?.standard_sale_price || 0,
    is_active: product?.is_active ?? true
  })

  // 카테고리 목록 조회
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true)
      const data = await getProductCategories()
      setCategories(data)
      setLoadingCategories(false)
    }
    fetchCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('품목 코드와 품명은 필수입니다')
      return
    }

    if (!formData.unit.trim()) {
      alert('단위를 입력하세요')
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await saveProduct({
        id: product?.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        category_id: formData.category_id || null,
        unit: formData.unit,
        specification: formData.specification.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        barcode: formData.barcode.trim() || null,
        min_stock_level: Number(formData.min_stock_level) || 0,
        standard_purchase_price: Number(formData.standard_purchase_price) || 0,
        standard_sale_price: Number(formData.standard_sale_price) || 0,
        is_active: formData.is_active,
        created_by: userId || null
      })

      if (result.success) {
        alert(result.message)
        onSuccess()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('품목 저장 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[90vh] overflow-y-auto mx-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? '품목 수정' : '새 품목 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">📋 기본 정보</h3>
            
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="code">품목 코드 *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="예: MED001"
                  disabled={isEdit}
                  required
                />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    영문+숫자 조합 (중복 불가)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">품명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 일회용 주사기 5ml"
                  required
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="category_id">카테고리 *</Label>
                {loadingCategories ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-400">
                    카테고리 로딩 중...
                  </div>
                ) : (
                  <select
                    id="category_id"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-muted-foreground">
                  품목 분류 (필수 선택)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">단위 *</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="예: EA, BOX, KG, L, SET"
                  maxLength={20}
                  required
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="specification">규격/사양</Label>
                <Input
                  id="specification"
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  placeholder="예: 100개입/박스"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">제조사</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="예: (주)메디텍"
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="barcode">바코드</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="선택사항"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_stock_level">최소 재고 수준</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  min="0"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  이 수준 이하 시 알림
                </p>
              </div>
            </FormGrid>
          </div>

          {/* 가격 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">💰 가격 정보</h3>
            
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="standard_purchase_price">표준 구매가 (원)</Label>
                <Input
                  id="standard_purchase_price"
                  type="number"
                  min="0"
                  value={formData.standard_purchase_price}
                  onChange={(e) => setFormData({ ...formData, standard_purchase_price: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  입고 시 기본값으로 사용
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="standard_sale_price">표준 판매가 (원)</Label>
                <Input
                  id="standard_sale_price"
                  type="number"
                  min="0"
                  value={formData.standard_sale_price}
                  onChange={(e) => setFormData({ ...formData, standard_sale_price: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  판매 시 기본값으로 사용
                </p>
              </div>
            </FormGrid>
          </div>

          {/* 상태 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, is_active: checked as boolean })
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              활성 상태
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '⏳ 저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
