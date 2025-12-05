'use client'

import { useState } from 'react'
import type { Client } from '@/types'
import { saveClient } from '@/app/clients/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Textarea } from '../ui/Textarea'
import { Checkbox } from '../ui/Checkbox'
import { FormGrid } from '../shared/FormGrid'

interface ClientFormProps {
  client: Client | null
  onClose: () => void
  onSuccess: () => void
}

export default function ClientForm({ client, onClose, onSuccess }: ClientFormProps) {
  const isEdit = !!client
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    code: client?.code || '',
    name: client?.name || '',
    type: client?.type || 'supplier',
    contact_person: client?.contact_person || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    tax_id: client?.tax_id || '',
    notes: client?.notes || '',
    is_active: client?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('거래처 코드와 상호명은 필수입니다')
      return
    }

    // 이메일 검증
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      alert('올바른 이메일 형식을 입력하세요')
      return
    }

    setIsSubmitting(true)
    
    try {
      const result = await saveClient({
        id: client?.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        type: formData.type as 'supplier' | 'customer' | 'both',
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        tax_id: formData.tax_id.replace(/[^0-9]/g, '') || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active
      })

      if (result.success) {
        alert(result.message)
        onSuccess()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('거래처 저장 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTaxId = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '거래처 수정' : '새 거래처 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">📋 기본 정보</h3>
            
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="code">거래처 코드 *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="예: SUP001"
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
                <Label htmlFor="name">상호명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: (주)메디텍"
                  required
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="type">거래처 유형 *</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'supplier' | 'customer' | 'both' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="supplier">공급업체</option>
                  <option value="customer">고객</option>
                  <option value="both">공급업체 + 고객</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  입고와 판매 모두 거래 시 '공급업체 + 고객' 선택
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">사업자등록번호</Label>
                <Input
                  id="tax_id"
                  value={formatTaxId(formData.tax_id)}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="예: 123-45-67890"
                  maxLength={12}
                />
              </div>
            </FormGrid>
          </div>

          {/* 담당자 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">👤 담당자 정보</h3>
            
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="contact_person">대표자/담당자명</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="예: 홍길동"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="예: 02-1234-5678"
                />
              </div>
            </FormGrid>

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="예: contact@company.com"
              />
            </div>
          </div>

          {/* 주소 및 메모 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">📍 주소 및 메모</h3>
            
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="예: 서울시 강남구 테헤란로 123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">메모</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="특이사항이나 참고사항을 입력하세요"
                rows={3}
              />
            </div>
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
          <p className="text-xs text-muted-foreground ml-6">
            비활성 시 입고/판매 선택 목록에 표시되지 않음
          </p>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} loading={isSubmitting}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
