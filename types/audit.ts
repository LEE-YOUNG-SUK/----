/**
 * Audit Log 타입 정의 (Phase 3)
 */

/**
 * Audit Log 액션 타입
 */
export type AuditAction = 'UPDATE' | 'DELETE'

/**
 * Audit Log 테이블명
 */
export type AuditTableName = 'purchases' | 'sales'

/**
 * Audit Log 레코드
 */
export interface AuditLog {
  id: string
  table_name: AuditTableName
  record_id: string
  action: AuditAction
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  changed_fields: string[] | null
  user_id: string
  username: string
  user_role: string
  branch_id: string | null
  branch_name: string | null
  created_at: string
}

/**
 * Audit Log 필터
 */
export interface AuditLogFilter {
  table_name?: AuditTableName
  action?: AuditAction
  user_id?: string
  branch_id?: string | null
  start_date?: string
  end_date?: string
}

/**
 * Audit Log 조회 결과
 */
export interface AuditLogListItem {
  id: string
  table_name: string
  record_id: string
  action: string
  username: string
  user_role: string
  branch_name: string | null
  changed_fields: string[] | null
  created_at: string
}

/**
 * 레코드 변경 이력
 */
export interface RecordHistory {
  id: string
  action: string
  username: string
  user_role: string
  branch_name: string | null
  changed_fields: string[] | null
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  created_at: string
}

/**
 * Audit Log 통계
 */
export interface AuditStats {
  table_name: string
  action: string
  count: number
  unique_users: number
  first_occurrence: string
  last_occurrence: string
}

/**
 * 사용자 활동
 */
export interface UserActivity {
  user_id: string
  username: string
  user_role: string
  branch_name: string | null
  total_actions: number
  updates: number
  deletes: number
  first_action: string
  last_action: string
}
