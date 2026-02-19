'use client'

import { useState } from 'react'
import { saveUser } from '@/app/admin/users/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/Dialog'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Label } from '../../ui/Label'
import { Checkbox } from '../../ui/Checkbox'
import { FormGrid } from '../../shared/FormGrid'

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

// 사용자 폼에서 필요한 지점 정보만 정의
interface SimpleBranch {
  id: string
  code: string
  name: string
}

interface UserFormProps {
  user: UserWithBranch | null
  branches: SimpleBranch[]
  currentUser: { role: string; branch_id: string | null }
  onClose: () => void
  onSuccess: () => void
}

export default function UserForm({ user, branches, currentUser, onClose, onSuccess }: UserFormProps) {
  const isEdit = !!user
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isDirector = currentUser.role === '0001'
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    passwordConfirm: '',
    display_name: user?.display_name || '',
    role: user?.role || '0003',
    branch_id: user?.branch_id || (isDirector ? currentUser.branch_id : ''),
    is_active: user?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사
    if (!isEdit && !formData.username.trim()) {
      alert('아이디는 필수입니다')
      return
    }

    // 아이디 검증 (신규 생성 시) - 한글, 영문, 숫자, 밑줄(_), 하이픈(-) 허용
    if (!isEdit) {
      const usernameRegex = /^[가-힣a-zA-Z0-9_-]+$/
      if (!usernameRegex.test(formData.username.trim())) {
        alert('아이디는 한글, 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다')
        return
      }
      
      // 위험한 문자 체크 (SQL Injection, XSS 방지)
      if (/[<>'"\\;`]/.test(formData.username)) {
        alert('아이디에 특수문자(<, >, \', ", \\, ;, `)는 사용할 수 없습니다')
        return
      }
      
      // 최소 길이 체크
      if (formData.username.trim().length < 2) {
        alert('아이디는 최소 2자 이상이어야 합니다')
        return
      }
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

  // 모든 역할에 지점 필수
  const isBranchRequired = true

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '사용자 수정' : '새 사용자 추가'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 계정 정보 */}
          <div className="space-y-4">
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="username">아이디 *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="예: 홍길동, user123, 관리자_01"
                  disabled={isEdit}
                  required
                  autoComplete="off"
                />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    한글, 영문, 숫자, 밑줄(_), 하이픈(-) 사용 가능 (최소 2자)
                  </p>
                )}
                {!isEdit && (
                  <p className="text-xs text-blue-600">
                    💡 같은 지점 내에서만 중복 불가 (다른 지점은 동일 아이디 가능)
                  </p>
                )}
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
            </FormGrid>

            <FormGrid columns={2}>
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
                  autoComplete="new-password"
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
                  placeholder="비밀번호를 한 번 더 입력하세요"
                  autoComplete="new-password"
                />
              </div>
            </FormGrid>
          </div>

          {/* 권한 및 지점 */}
          <div className="space-y-4">
            <FormGrid columns={2}>
              <div className="space-y-2">
                <Label htmlFor="role">권한 *</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {!isDirector && <option value="0000">시스템 관리자</option>}
                  {!isDirector && <option value="0001">원장</option>}
                  <option value="0002">매니저</option>
                  <option value="0003">직원</option>
                </select>
                {isDirector && (
                  <p className="text-xs text-blue-600">
                    원장은 매니저/직원만 생성 가능
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">
                  소속 지점 {isBranchRequired && '*'}
                </Label>
                {isDirector ? (
                  <>
                    <select
                      id="branch_id"
                      value={formData.branch_id || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      disabled
                    >
                      {branches.map(branch => (
                        branch.id === currentUser.branch_id && (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        )
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      본인 지점으로 자동 설정
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      id="branch_id"
                      value={formData.branch_id || ''}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={isBranchRequired}
                    >
                      <option value="">선택하세요</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    {isBranchRequired && (
                      <p className="text-xs text-muted-foreground">
                        원장/매니저/직원은 필수 선택
                      </p>
                    )}
                  </>
                )}
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
