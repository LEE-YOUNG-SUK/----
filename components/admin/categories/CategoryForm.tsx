'use client'

import { useState } from 'react'
import type { ProductCategory } from '@/app/admin/categories/actions'
import { saveCategory } from '@/app/admin/categories/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormGrid } from '@/components/shared/FormGrid'

interface CategoryFormProps {
  category: ProductCategory | null
  onClose: () => void
  onSuccess: () => void
}

export default function CategoryForm({ category, onClose, onSuccess }: CategoryFormProps) {
  const isEdit = !!category
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    code: category?.code || '',
    name: category?.name || '',
    description: category?.description || '',
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('카테고리 코드와 이름은 필수입니다')
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await saveCategory({
        id: category?.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        display_order: Number(formData.display_order) || 0,
        is_active: formData.is_active
      })

      if (result.success) {
        alert(result.message)
        onSuccess()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('카테고리 저장 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? '카테고리 수정' : '새 카테고리 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">📋 기본 정보</h3>
            
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="code">카테고리 코드 *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="예: 00014"
                  disabled={isEdit}
                  required
                />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    5자리 숫자 (중복 불가)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">카테고리명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 기타용품"
                  required
                />
              </div>
            </FormGrid>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="카테고리에 대한 간단한 설명 (선택사항)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">표시 순서</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                숫자가 작을수록 먼저 표시됩니다
              </p>
            </div>
          </div>

          {/* 상태 */}
          {isEdit && (
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
          )}

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

