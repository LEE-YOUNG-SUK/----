// types/purchases.ts

/**
 * 입고 관리 관련 타입 정의
 */

import { Product, Client } from './index'

/**
 * 입고 그리드 행 데이터
 */
export interface PurchaseGridRow {
  id: string // 임시 ID (클라이언트 생성)
  product_id: string | null
  product_code: string
  product_name: string
  category: string
  unit: string
  quantity: number
  unit_cost: number // 사용자 입력 단가
  supply_price: number // 공급가 (자동계산)
  tax_amount: number // 부가세 (자동계산, 정수)
  total_price: number // 합계 (자동계산)
  total_cost: number // 기존 호환성 유지
  specification: string
  notes: string
}

/**
 * 일괄 입고 RPC 응답
 */
export interface BatchPurchaseResponse {
  success: boolean
  message: string
  transaction_number: string | null
  purchase_ids: string[] | null
  total_items: number
  total_amount: number
}

/**
 * 입고 저장 요청 데이터
 */
export interface PurchaseSaveRequest {
  branch_id: string
  supplier_id: string | null  // ✅ 선택사항으로 변경 (null 허용)
  purchase_date: string // YYYY-MM-DD
  reference_number: string
  notes: string
  items: PurchaseGridRow[]
  created_by: string
    tax_amount?: number; // 부가세 (선택, 일괄입력용)
}

/**
 * 입고 내역 조회 데이터
 */
export interface PurchaseHistory {
  id: string
  branch_id: string
  branch_name: string
  client_id: string
  client_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  purchase_date: string
  quantity: number
  unit_cost: number
  total_cost: number
  supply_price: number  // 공급가 (세전)
  tax_amount: number    // 부가세
  reference_number: string
  notes: string
  created_at: string
  created_by: string
  created_by_name: string  // 담당자 이름
  updated_by: string | null  // 수정 담당자 ID
  updated_by_name: string | null  // 수정 담당자 이름
  updated_at: string | null  // 수정 시각
}

/**
 * Phase 3.5: 입고 수정 요청 데이터
 */
export interface PurchaseUpdateRequest {
  purchase_id: string
  user_id: string
  user_role: string
  user_branch_id: string
  quantity: number
  unit_cost: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
}

/**
 * 거래번호별 그룹화된 입고 데이터
 */
export interface PurchaseGroup {
  reference_number: string // 거래번호
  purchase_date: string
  client_id: string
  client_name: string
  branch_id: string
  branch_name: string
  items: PurchaseHistory[] // 해당 거래번호의 모든 품목
  total_amount: number // 총 금액
  total_items: number // 품목 수
  first_product_name: string // 첫 번째 품목명
  created_at: string
  created_by: string
}

/**
 * Phase 3.5: 입고 삭제 요청 데이터
 */
export interface PurchaseDeleteRequest {
  purchase_id: string
  user_id: string
  user_role: string
  user_branch_id: string
}

/**
 * 입고 통계
 */
export interface PurchaseStats {
  today_count: number
  today_total_amount: number
  week_count: number
  week_total_amount: number
  month_count: number
  month_total_amount: number
}

/**
 * RPC 응답 타입
 */
export interface PurchaseRpcResponse {
  success: boolean
  message: string
  purchase_id: string
}

/**
 * 품목 자동완성용 옵션
 */
export interface ProductOption {
  value: string // product_id
  label: string // product_code + product_name
  product: Product
}