'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PermissionResource, PermissionAction } from '@/types/permissions'

interface Props {
  role: string
  resource: PermissionResource
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * 권한이 있을 때만 children을 렌더링하는 컴포넌트
 */
export function ProtectedAction({ 
  role, 
  resource, 
  action, 
  children, 
  fallback = null 
}: Props) {
  const { can } = usePermissions(role)
  
  if (!can(resource, action)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}