// 권한 리소스 타입
export type PermissionResource = 
  | 'users_management'      // 사용자 관리
  | 'branches_management'   // 지점 관리
  | 'clients_management'    // 거래처 관리
  | 'products_management'   // 품목 관리
  | 'purchases_management'  // 입고 관리
  | 'sales_management'      // 판매 관리
  | 'inventory_view'        // 재고 조회

// 권한 액션 타입
export type PermissionAction = 'read' | 'create' | 'update' | 'delete'

// 권한 객체
export interface Permission {
  resource: PermissionResource
  action: PermissionAction
}

// 역할별 권한 맵
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // 0000: 시스템 관리자 - 모든 권한
  '0000': [
    // 사용자 관리
    { resource: 'users_management', action: 'read' },
    { resource: 'users_management', action: 'create' },
    { resource: 'users_management', action: 'update' },
    { resource: 'users_management', action: 'delete' },
    
    // 지점 관리
    { resource: 'branches_management', action: 'read' },
    { resource: 'branches_management', action: 'create' },
    { resource: 'branches_management', action: 'update' },
    { resource: 'branches_management', action: 'delete' },
    
    // 거래처 관리
    { resource: 'clients_management', action: 'read' },
    { resource: 'clients_management', action: 'create' },
    { resource: 'clients_management', action: 'update' },
    { resource: 'clients_management', action: 'delete' },
    
    // 품목 관리
    { resource: 'products_management', action: 'read' },
    { resource: 'products_management', action: 'create' },
    { resource: 'products_management', action: 'update' },
    { resource: 'products_management', action: 'delete' },
    
    // 입고 관리
    { resource: 'purchases_management', action: 'read' },
    { resource: 'purchases_management', action: 'create' },
    { resource: 'purchases_management', action: 'update' },
    { resource: 'purchases_management', action: 'delete' },
    
    // 판매 관리
    { resource: 'sales_management', action: 'read' },
    { resource: 'sales_management', action: 'create' },
    { resource: 'sales_management', action: 'update' },
    { resource: 'sales_management', action: 'delete' },
    
    // 재고 조회
    { resource: 'inventory_view', action: 'read' },
  ],
  
  // 0001: 원장 - 본인 지점 전체 CRUD (사용자/지점 관리 제외)
  '0001': [
    // 거래처 (읽기만)
    { resource: 'clients_management', action: 'read' },
    
    // 품목 (읽기만)
    { resource: 'products_management', action: 'read' },
    
    // 입고 (전체)
    { resource: 'purchases_management', action: 'read' },
    { resource: 'purchases_management', action: 'create' },
    { resource: 'purchases_management', action: 'update' },
    { resource: 'purchases_management', action: 'delete' },
    
    // 판매 (전체)
    { resource: 'sales_management', action: 'read' },
    { resource: 'sales_management', action: 'create' },
    { resource: 'sales_management', action: 'update' },
    { resource: 'sales_management', action: 'delete' },
    
    // 재고 조회
    { resource: 'inventory_view', action: 'read' },
  ],
  
  // 0002: 매니저 - 원장과 동일
  '0002': [
    { resource: 'clients_management', action: 'read' },
    { resource: 'products_management', action: 'read' },
    { resource: 'purchases_management', action: 'read' },
    { resource: 'purchases_management', action: 'create' },
    { resource: 'purchases_management', action: 'update' },
    { resource: 'purchases_management', action: 'delete' },
    { resource: 'sales_management', action: 'read' },
    { resource: 'sales_management', action: 'create' },
    { resource: 'sales_management', action: 'update' },
    { resource: 'sales_management', action: 'delete' },
    { resource: 'inventory_view', action: 'read' },
  ],
  
  // 0003: 사용자 - 원장과 동일
  '0003': [
    { resource: 'clients_management', action: 'read' },
    { resource: 'products_management', action: 'read' },
    { resource: 'purchases_management', action: 'read' },
    { resource: 'purchases_management', action: 'create' },
    { resource: 'purchases_management', action: 'update' },
    { resource: 'purchases_management', action: 'delete' },
    { resource: 'sales_management', action: 'read' },
    { resource: 'sales_management', action: 'create' },
    { resource: 'sales_management', action: 'update' },
    { resource: 'sales_management', action: 'delete' },
    { resource: 'inventory_view', action: 'read' },
  ],
}

// 역할명 매핑
export const ROLE_LABELS: Record<string, string> = {
  '0000': '시스템 관리자',
  '0001': '원장',
  '0002': '매니저',
  '0003': '사용자',
}

// 역할 아이콘
export const ROLE_ICONS: Record<string, string> = {
  '0000': '🔑',
  '0001': '👔',
  '0002': '📊',
  '0003': '👤',
}