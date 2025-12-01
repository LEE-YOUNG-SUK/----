// types/inventory-adjustment.ts

/**
 * 재고 조정 관련 타입 정의
 * Phase 5: Inventory Adjustment System
 */

/**
 * 재고 조정 유형
 */
export type AdjustmentType = 'INCREASE' | 'DECREASE'

/**
 * 재고 조정 사유
 */
export type AdjustmentReason = 
  | 'STOCK_COUNT'  // 실사
  | 'DAMAGE'       // 불량
  | 'LOSS'         // 분실
  | 'RETURN'       // 반품
  | 'OTHER'        // 기타

/**
 * 재고 조정 사유 라벨
 */
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  STOCK_COUNT: '실사',
  DAMAGE: '불량',
  LOSS: '분실',
  RETURN: '반품',
  OTHER: '기타'
}

/**
 * 재고 조정 유형 라벨
 */
export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  INCREASE: '증가',
  DECREASE: '감소'
}

/**
 * 재고 조정 레코드 (DB 조회 결과)
 */
export interface InventoryAdjustment {
  id: string
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  adjustment_type: AdjustmentType
  adjustment_reason: AdjustmentReason
  quantity: number
  unit_cost: number
  supply_price: number | null
  tax_amount: number | null
  total_cost: number
  adjustment_date: string // YYYY-MM-DD
  notes: string | null
  reference_number: string | null
  created_by: string
  created_by_username: string
  created_at: string // ISO timestamp
  is_cancelled: boolean
  cancelled_by: string | null
  cancelled_by_username: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

/**
 * 재고 조정 저장 요청 데이터
 */
export interface AdjustmentSaveRequest {
  branch_id: string
  product_id: string
  adjustment_type: AdjustmentType
  adjustment_reason: AdjustmentReason
  quantity: number
  unit_cost?: number | null // INCREASE 시 필수
  supply_price?: number | null
  tax_amount?: number | null
  total_cost?: number | null
  notes?: string
  reference_number?: string
  adjustment_date: string // YYYY-MM-DD
  // 사용자 컨텍스트 (Server Action에서 세션에서 추출)
  user_id: string
  user_role: string
  user_branch_id: string
}

/**
 * 재고 조정 처리 응답 (RPC 반환값)
 */
export interface AdjustmentProcessResponse {
  success: boolean
  message: string
  adjustment_id: string | null
}

/**
 * 재고 조정 내역 조회 필터
 */
export interface AdjustmentFilters {
  start_date?: string | null // YYYY-MM-DD
  end_date?: string | null   // YYYY-MM-DD
  adjustment_type?: AdjustmentType | null
  adjustment_reason?: AdjustmentReason | null
}

/**
 * 재고 조정 통계 (RPC 반환값)
 */
export interface AdjustmentSummary {
  total_adjustments: number
  increase_count: number
  decrease_count: number
  total_increase_value: number
  total_decrease_value: number
  by_reason: Record<AdjustmentReason, {
    count: number
    total_cost: number
  }>
}

/**
 * 재고 조정 취소 요청
 */
export interface AdjustmentCancelRequest {
  adjustment_id: string
  cancel_reason: string
  // 사용자 컨텍스트
  user_id: string
  user_role: string
  user_branch_id: string
}

/**
 * 재고 조정 취소 응답 (RPC 반환값)
 */
export interface AdjustmentCancelResponse {
  success: boolean
  message: string
}

/**
 * 재고 조정 폼 데이터 (UI 상태)
 */
export interface AdjustmentFormData {
  product_id: string
  adjustment_type: AdjustmentType
  adjustment_reason: AdjustmentReason
  quantity: number
  unit_cost: number | null
  supply_price: number | null
  tax_amount: number | null
  total_cost: number | null
  notes: string
  reference_number: string
  adjustment_date: string // YYYY-MM-DD
}

/**
 * 품목 검색 자동완성 결과
 */
export interface ProductSearchResult {
  id: string
  code: string
  name: string
  category: string
  unit: string
  current_stock: number // 현재 재고 (참고용)
}
