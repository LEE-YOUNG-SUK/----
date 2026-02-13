'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/hooks/useConfirm'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/Table'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { deleteUser } from '@/app/admin/users/actions'
import { ROLE_LABELS } from '@/types/permissions'

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

interface UserTableProps {
  users: UserWithBranch[]
  permissions: {
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (user: UserWithBranch) => void
}

export default function UserTable({ users, permissions, onEdit }: UserTableProps) {
  const router = useRouter()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const getRoleVariant = (role: string) => {
    switch (role) {
      case '0000': return 'destructive'
      case '0001': return 'default'
      case '0002': return 'secondary'
      case '0003': return 'outline'
      default: return 'default'
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const handleDelete = async (user: UserWithBranch) => {
    if (user.username === 'admin') {
      alert('admin 계정은 삭제할 수 없습니다')
      return
    }

    const ok = await confirm({ title: '삭제 확인', message: `'${user.username}' 사용자를 삭제하시겠습니까?`, variant: 'danger' })
    if (!ok) return

    setDeletingId(user.id)
    try {
      const result = await deleteUser(user.id)
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('사용자 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          검색 결과가 없습니다
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>사용자 목록</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>아이디</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>권한</TableHead>
                <TableHead>소속 지점</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>최근 로그인</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.display_name}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleVariant(user.role) as any}>
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.branch_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? '✅ 활성' : '❌ 비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(user.last_login_at)}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {permissions.canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(user)}
                        >
                          ✏️ 수정
                        </Button>
                      )}
                      {permissions.canDelete && user.username !== 'admin' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id}
                        >
                          {deletingId === user.id ? '⏳' : '🗑️'} 삭제
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    {ConfirmDialogComponent}
  </>
  )
}
