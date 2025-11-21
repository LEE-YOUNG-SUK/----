'use client'

import { useState } from 'react'
import type { Branch } from '@/types'
import { saveUser } from '@/app/admin/users/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/Dialog'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Label } from '../../ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select'
import { Checkbox } from '../../ui/Checkbox'

interface UserWithBranch {
  id: string
  username: string
  display_name: string
  role: string
  branch_id: string | null
  branch_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

interface UserFormProps {
  user: UserWithBranch | null
  branches: Branch[]
  onClose: () => void
  onSuccess: () => void
}

export default function UserForm({ user, branches, onClose, onSuccess }: UserFormProps) {
  const isEdit = !!user
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    passwordConfirm: '',
    display_name: user?.display_name || '',
    role: user?.role || '0003',
    branch_id: user?.branch_id || '',
    is_active: user?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사
    if (!isEdit && !formData.username.trim()) {
      alert('아이디는 필수입니다')
      return
    }

    if (!formData.display_name.trim()) {
      alert('표시 이름은 필수입니다')
      return
    }

    // 비밀번호 검증 (신규 생성 시)
    if (!isEdit) {
      if (!formData.password) {
        alert('비밀번호는 필수입니다')
        return
      }
      if (formData.password.length < 6) {
        alert('비밀번호는 최소 6자 이상이어야 합니다')
        return
      }
      if (formData.password !== formData.passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다')
        return
      }
    }

    // 비밀번호 변경 시 검증 (수정 시)
    if (isEdit && formData.password) {
      if (formData.password.length < 6) {
        alert('비밀번호는 최소 6자 이상이어야 합니다')
        return
      }
      if (formData.password !== formData.passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다')
        return
      }
    }

    setIsSubmitting(true)
    
    try {
      const result = await saveUser({
        id: user?.id,
        username: formData.username.trim(),
        password: formData.password || undefined,
        display_name: formData.display_name.trim(),
        role: formData.role,
        branch_id: formData.branch_id || null,
        is_active: formData.is_active
      })

      if (result.success) {
        alert(result.message)
        onSuccess()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('사용자 저장 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 역할에 따라 지점 필수 여부 결정
  const isBranchRequired = ['0001', '0002', '0003'].includes(formData.role)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '사용자 수정' : '새 사용자 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 계정 정보 */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">아이디 *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="영문, 숫자 조합"
                  disabled={isEdit}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">표시 이름 *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="홍길동"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  비밀번호 {isEdit ? '' : '*'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="최소 6자 이상"
                  required={!isEdit}
                />
                <p className="text-xs text-muted-foreground">
                  {isEdit ? '변경 시만 입력' : '필수 입력'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  placeholder="비밀번호 재입력"
                />
              </div>
            </div>
          </div>

          {/* 권한 및 지점 */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">권한 *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0000">시스템 관리자</SelectItem>
                    <SelectItem value="0001">원장</SelectItem>
                    <SelectItem value="0002">매니저</SelectItem>
                    <SelectItem value="0003">직원</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">
                  소속 지점 {isBranchRequired && '*'}
                </Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">없음</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isBranchRequired && (
                  <p className="text-xs text-muted-foreground">
                    원장/매니저/직원은 필수 선택
                  </p>
                )}
              </div>
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
