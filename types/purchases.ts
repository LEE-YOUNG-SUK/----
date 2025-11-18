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
  unit_cost: number
  total_cost: number
  specification: string
  manufacturer: string
  notes: string
}

/**
 * 입고 저장 요청 데이터
 */
export interface PurchaseSaveRequest {
  branch_id: string
  supplier_id: string
  purchase_date: string // YYYY-MM-DD
  reference_number: string
  notes: string
  items: PurchaseGridRow[]
  created_by: string
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
  reference_number: string
  notes: string
  created_at: string
  created_by: string
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