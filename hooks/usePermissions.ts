'use client'

import { useMemo } from 'react'
import { PermissionChecker } from '@/lib/permissions'
import { PermissionResource, PermissionAction } from '@/types/permissions'

/**
 * 클라이언트 컴포넌트용 권한 Hook
 */
export function usePermissions(role: string) {
  const checker = useMemo(() => new PermissionChecker(role), [role])
  
  const can = (resource: PermissionResource, action: PermissionAction) => {
    return checker.can(resource, action)
  }
  
  const canAny = (resource: PermissionResource, actions: PermissionAction[]) => {
    return checker.canAny(resource, actions)
  }
  
  const canAll = (resource: PermissionResource, actions: PermissionAction[]) => {
    return checker.canAll(resource, actions)
  }
  
  const isSystemAdmin = () => {
    return checker.isSystemAdmin()
  }
  
  return {
    can,
    canAny,
    canAll,
    isSystemAdmin,
    permissions: checker.getAllPermissions()
  }
}