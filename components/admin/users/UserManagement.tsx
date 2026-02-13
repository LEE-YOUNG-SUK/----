'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserData } from '@/types'
import UserTable from './UserTable'
import UserForm from './UserForm'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Card, CardContent } from '../../ui/Card'

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

// 사용자 관리에서 필요한 지점 정보만 정의
interface SimpleBranch {
  id: string
  code: string
  name: string
}

interface UserManagementProps {
  initialUsers: UserWithBranch[]
  branches: SimpleBranch[]
  currentUser: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
}

export default function UserManagement({
  initialUsers,
  branches,
  currentUser,
  permissions
}: UserManagementProps) {
  const router = useRouter()
  const [users] = useState<UserWithBranch[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithBranch | null>(null)

  // 검색 + 지점 필터링
  const filteredUsers = users.filter(user => {
    const matchSearch = !searchTerm ||
      (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchBranch = !selectedBranch || user.branch_id === selectedBranch
    return matchSearch && matchBranch
  })

  const handleAddNew = () => {
    setSelectedUser(null)
    setIsFormOpen(true)
  }

  const handleEdit = (user: UserWithBranch) => {
    setSelectedUser(user)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedUser(null)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    setSelectedUser(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 버튼 */}
      <div className="flex items-center gap-4">
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          <option value="">전체 지점</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <Input
          placeholder="검색 (아이디, 이름)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        {permissions.canCreate && (
          <Button onClick={handleAddNew} size="lg" className="whitespace-nowrap">
            + 새 사용자 추가
          </Button>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {filteredUsers.length}명의 사용자
      </div>

      {/* 테이블 */}
      <UserTable
        users={filteredUsers}
        permissions={permissions}
        onEdit={handleEdit}
      />

      {/* 폼 모달 */}
      {isFormOpen && (
        <UserForm
          user={selectedUser}
          branches={branches}
          currentUser={currentUser}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
