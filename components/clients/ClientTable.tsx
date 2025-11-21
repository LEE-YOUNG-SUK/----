'use client'

import type { Client } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { deleteClient } from '@/app/clients/actions'
import { useState } from 'react'

interface ClientTableProps {
  clients: Client[]
  permissions: {
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (client: Client) => void
}

export default function ClientTable({ clients, permissions, onEdit }: ClientTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const getTypeText = (type: string) => {
    switch (type) {
      case 'supplier': return '공급업체'
      case 'customer': return '고객'
      case 'both': return '공급업체 + 고객'
      default: return type
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'supplier': return 'default'
      case 'customer': return 'secondary'
      case 'both': return 'outline'
      default: return 'default'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const formatTaxId = (taxId: string | null) => {
    if (!taxId) return '-'
    if (taxId.length === 10) {
      return `${taxId.slice(0, 3)}-${taxId.slice(3, 5)}-${taxId.slice(5)}`
    }
    return taxId
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`'${client.name}' 거래처를 삭제하시겠습니까?\n\n연결된 입고/판매 내역이 있으면 삭제할 수 없습니다.`)) {
      return
    }

    setDeletingId(client.id)
    try {
      const result = await deleteClient(client.id)
      if (result.success) {
        alert(result.message)
        window.location.reload()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('거래처 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          검색 결과가 없습니다
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>거래처 목록</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>거래처코드</TableHead>
                <TableHead>상호명</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>대표자</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>사업자번호</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.code}</TableCell>
                  <TableCell>{client.name}</TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(client.type) as any}>
                      {getTypeText(client.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{client.contact_person || '-'}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell>{client.email || '-'}</TableCell>
                  <TableCell>{formatTaxId(client.tax_id)}</TableCell>
                  <TableCell>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? '✅ 활성' : '❌ 비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(client.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {permissions.canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(client)}
                        >
                          ✏️ 수정
                        </Button>
                      )}
                      {permissions.canDelete && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(client)}
                          disabled={deletingId === client.id}
                        >
                          {deletingId === client.id ? '⏳' : '🗑️'} 삭제
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
  )
}
