'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Client, UserData } from '@/types'
import ClientTable from './ClientTable'
import ClientForm from './ClientForm'

interface ClientManagementProps {
  initialClients: Client[]
  userData: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
  branches?: { id: string; name: string }[]
}

export default function ClientManagement({
  initialClients,
  userData,
  permissions,
  branches = [],
}: ClientManagementProps) {
  const router = useRouter()
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
    setIsFormOpen(false)
    setSelectedClient(null)
    router.refresh()
  }

  return (
    <>
      <ClientTable
        clients={clients}
        filteredClients={filteredClients}
        onFilterChange={setFilteredClients}
        permissions={permissions}
        onEdit={handleEdit}
        onAddNew={handleAddNew}
        userData={userData}
      />

      {/* 폼 모달 */}
      {isFormOpen && (
        <ClientForm
          client={selectedClient}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
          userId={userData.user_id}
          userData={userData}
          branches={branches}
        />
      )}
    </>
  )
}
