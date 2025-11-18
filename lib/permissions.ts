import { 
  Permission, 
  PermissionResource, 
  PermissionAction,
  ROLE_PERMISSIONS 
} from '@/types/permissions'

/**
 * 권한 체크 클래스
 */
export class PermissionChecker {
  private permissions: Permission[]
  
  constructor(role: string) {
    this.permissions = ROLE_PERMISSIONS[role] || []
  }
  
  /**
   * 특정 리소스와 액션에 대한 권한 확인
   */
  can(resource: PermissionResource, action: PermissionAction): boolean {
    return this.permissions.some(
      p => p.resource === resource && p.action === action
    )
  }
  
  /**
   * 여러 액션 중 하나라도 가능한지 확인
   */
  canAny(resource: PermissionResource, actions: PermissionAction[]): boolean {
    return actions.some(action => this.can(resource, action))
  }
  
  /**
   * 모든 액션이 가능한지 확인
   */
  canAll(resource: PermissionResource, actions: PermissionAction[]): boolean {
    return actions.every(action => this.can(resource, action))
  }
  
  /**
   * 시스템 관리자인지 확인
   */
  isSystemAdmin(): boolean {
    return this.permissions === ROLE_PERMISSIONS['0000']
  }
  
  /**
   * 모든 권한 목록 반환
   */
  getAllPermissions(): Permission[] {
    return [...this.permissions]
  }
}

/**
 * 역할 기반 권한 체크 (간편 함수)
 */
export function hasPermission(
  role: string,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  const checker = new PermissionChecker(role)
  return checker.can(resource, action)
}

/**
 * 시스템 관리자 여부 체크
 */
export function isSystemAdmin(role: string): boolean {
  return role === '0000'
}