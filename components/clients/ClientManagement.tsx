'use client'

import { useState } from 'react'
import type { Client, UserData } from '@/types'
import ClientTable from './ClientTable'
import ClientForm from './ClientForm'
import ClientFilters from './ClientFilters'
import { Button } from '../ui/Button'

interface ClientManagementProps {
  initialClients: Client[]
  userData: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
}

export default function ClientManagement({
  initialClients,
  userData,
  permissions
}: ClientManagementProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [filteredClients, setFilteredClients] = useState<Client[]>(initialClients)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const handleAddNew = () => {
    setSelectedClient(null)
    setIsFormOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedClient(null)
  }

  const handleSuccess = () => {
    // 페이지 새로고침으로 데이터 갱신
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* 필터 및 버튼 */}
      <div className="flex items-center gap-4">
        <ClientFilters 
          clients={clients}
          onFilterChange={setFilteredClients}
        />
        {permissions.canCreate && (
          <Button onClick={handleAddNew} size="lg" className="whitespace-nowrap">
            ➕ 새 거래처 추가
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <ClientTable
        clients={filteredClients}
        permissions={permissions}
        onEdit={handleEdit}
      />

      {/* 폼 모달 */}
      {isFormOpen && (
        <ClientForm
          client={selectedClient}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
