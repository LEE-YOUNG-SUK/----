"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branch, UserData } from '@/types'
import BranchTable from './BranchTable'
import BranchForm from './BranchForm'

interface BranchManagementProps {
  branches: Branch[]
  userData: UserData
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
}

export default function BranchManagement({
  branches,
  userData,
  permissions
}: BranchManagementProps) {
  const router = useRouter()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)

  const handleAddNew = () => {
    setSelectedBranch(null)
    setIsFormOpen(true)
  }

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedBranch(null)
  }

  const handleSuccess = () => {
    setIsFormOpen(false)
    setSelectedBranch(null)
    router.refresh()
  }

  return (
    <>
      <BranchTable
        branches={branches}
        permissions={permissions}
        onEdit={handleEdit}
        onAddNew={handleAddNew}
      />
      {isFormOpen && (
        <BranchForm
          branch={selectedBranch}
          onClose={handleFormClose}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
