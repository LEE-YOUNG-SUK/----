'use client'

import { useState } from 'react'
import type { UserData, Branch } from '@/types'
import UserTable from './UserTable'
import UserForm from './UserForm'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'

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

interface UserManagementProps {
  initialUsers: UserWithBranch[]
  branches: Branch[]
  userData: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
}

export default function UserManagement({
  initialUsers,
  branches,
  userData,
  permissions
}: UserManagementProps) {
  const [users, setUsers] = useState<UserWithBranch[]>(initialUsers)
  const [filteredUsers, setFilteredUsers] = useState<UserWithBranch[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithBranch | null>(null)

  // 검색 필터링
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    if (!term) {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(term.toLowerCase()) ||
        user.display_name.toLowerCase().includes(term.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }

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
    // 페이지 새로고침으로 데이터 갱신
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 버튼 */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="🔍 검색 (아이디, 이름)"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" onClick={() => handleSearch('')}>
          🔄 초기화
        </Button>
        {permissions.canCreate && (
          <Button onClick={handleAddNew} size="lg" className="whitespace-nowrap">
            ➕ 새 사용자 추가
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
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
