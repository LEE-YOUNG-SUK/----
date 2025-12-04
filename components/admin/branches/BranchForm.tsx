"use client"
import { useState } from 'react'
import type { Branch } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FormGrid } from '@/components/shared/FormGrid'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { SecondaryButton } from '@/components/shared/SecondaryButton'
import { createBranch, updateBranch } from '@/app/admin/branches/actions'

interface BranchFormProps {
  branch: Branch | null
  onClose: () => void
  onSuccess: () => void
}

export default function BranchForm({ branch, onClose, onSuccess }: BranchFormProps) {
  const [formData, setFormData] = useState({
    code: branch?.code || '',
    name: branch?.name || '',
    contact_person: branch?.contact_person || '',
    email: branch?.email || '',
    business_number: branch?.business_number || '',
    address: branch?.address || '',
    phone: branch?.phone || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = branch
        ? await updateBranch(branch.id, formData)
        : await createBranch(formData as any)

      if (result.success) {
        onSuccess()
      } else {
        setError(result.message || '저장에 실패했습니다')
      }
    } catch (err) {
      setError('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{branch ? '지점 수정' : '새 지점 추가'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="code">지점 코드 *</Label>
                <Input
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="예: BR01"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">지점명 *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="예: 강남점"
                  required
                  disabled={loading}
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="contact_person">대표자</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  placeholder="예: 홍길동"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="예: 02-1234-5678"
                  disabled={loading}
                />
              </div>
            </FormGrid>

            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="예: branch@example.com"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_number">사업자번호</Label>
                <Input
                  id="business_number"
                  name="business_number"
                  value={formData.business_number}
                  onChange={handleChange}
                  placeholder="예: 123-45-67890"
                  disabled={loading}
                />
              </div>
            </FormGrid>

            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="예: 서울시 강남구 테헤란로 123"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <SecondaryButton type="button" onClick={onClose} disabled={loading}>
              취소
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading} loading={loading}>
              {branch ? '수정' : '추가'}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
