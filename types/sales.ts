/**
 * 판매 관리 타입 정의
 * 입고 관리(purchases.ts) 구조 100% 적용
 */

// 거래 유형 추가
export type TransactionType = 'SALE' | 'USAGE'

// 재고 포함 품목 (판매용)
export interface ProductWithStock {
  id: string
  code: string
  name: string
  category: string | null
  unit: string
  specification: string | null
  standard_sale_price: number
  current_stock: number  // 판매만의 특별 필드!
}

// 판매 그리드 행 (PurchaseGridRow 패턴)
export interface SaleGridRow {
  id: string  // temp_${Date.now()}_${Math.random()}
  product_id: string | null
  product_code: string
  product_name: string
  category: string
  unit: string
  specification: string
  current_stock: number  // 재고 수량
  quantity: number
  unit_price: number      // 사용자 입력 단가
  supply_price: number    // 공급가 (자동계산)
  tax_amount: number      // 부가세 (자동계산, 정수)
  total_price: number     // 합계 (자동계산)
  notes: string
  transaction_type?: TransactionType  // 거래유형 (선택)
}

// 판매 저장 요청
export interface SaleSaveRequest {
  branch_id: string
  customer_id: string | null
  sale_date: string
  reference_number: string
  notes: string
  items: SaleGridRow[]
  tax_amount?: number
  transaction_type?: TransactionType
}

// 판매 내역
export interface SaleHistory {
  id: string
  branch_id: string        // 지점 ID (품목 추가용)
  client_id: string | null // 거래처 ID (품목 추가용)
  product_id: string       // 품목 ID (품목 추가용)
  sale_date: string
  branch_name: string
  customer_name: string
  product_code: string
  product_name: string
  unit: string
  quantity: number
  unit_price: number
  total_price: number
  cost_of_goods_sold: number
  profit: number
  profit_margin: number
  supply_price: number   // 공급가 (세전)
  tax_amount: number     // 부가세
  reference_number: string | null
  notes: string
  created_by_name: string  // 담당자 이름
  created_at: string
  transaction_type?: TransactionType // 거래유형
  updated_by: string | null  // 수정 담당자 ID
  updated_by_name: string | null  // 수정 담당자 이름
  updated_at: string | null  // 수정 시각
}

/**
 * Phase 3.5: 판매 수정 요청 데이터
 */
export interface SaleUpdateRequest {
  sale_id: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
}

/**
 * Phase 3.5: 판매 삭제 요청 데이터
 */
export interface SaleDeleteRequest {
  sale_id: string
}

/**
 * 거래번호별 그룹화된 판매 데이터 (PurchaseGroup 구조와 동일)
 */
export interface SaleGroup {
  reference_number: string // 거래번호
  sale_date: string
  branch_id: string        // 지점 ID (품목 추가용)
  client_id: string | null // 거래처 ID (품목 추가용)
  customer_name: string
  items: SaleHistory[]
  total_price: number
  total_items: number
  first_product_name: string
}

// 고객 (거래처)
export interface Customer {
  id: string
  code: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
}

// 일괄 판매 RPC 응답
export interface BatchSaleResponse {
  success: boolean
  message: string
  transaction_number: string | null
  sale_ids: string[] | null
  total_items: number
  total_amount: number
  total_cost: number
  total_profit: number
}

// RPC 응답
export interface SaleRpcResponse {
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  cost_of_goods_sold: number
  profit: number
  message: string
}