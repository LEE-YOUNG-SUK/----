/**
 * 판매 관리 타입 정의
 * 입고 관리(purchases.ts) 구조 100% 적용
 */

// 재고 포함 품목 (판매용)
export interface ProductWithStock {
  id: string
  code: string
  name: string
  category: string | null
  unit: string
  specification: string | null
  manufacturer: string | null
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
  manufacturer: string
  current_stock: number  // 재고 수량
  quantity: number
  unit_price: number      // 사용자 입력 단가
  supply_price: number    // 공급가 (자동계산)
  tax_amount: number      // 부가세 (자동계산, 정수)
  total_price: number     // 합계 (자동계산)
  total_amount: number    // 기존 호환성 유지
  notes: string
}

// 판매 저장 요청
export interface SaleSaveRequest {
  branch_id: string
  customer_id: string
  sale_date: string
  reference_number: string
  notes: string
  items: SaleGridRow[]
  created_by: string
    tax_amount?: number; // 부가세 (선택, 일괄입력용)
}

// 판매 내역
export interface SaleHistory {
  id: string
  sale_date: string
  branch_name: string
  customer_name: string
  product_code: string
  product_name: string
  unit: string
  quantity: number
  unit_price: number
  total_amount: number
  cost_of_goods: number
  profit: number
  profit_margin: number
  reference_number: string | null
  created_by_name: string
  created_at: string
    tax_amount?: number; // 부가세 (선택)
}

/**
 * Phase 3.5: 판매 수정 요청 데이터
 */
export interface SaleUpdateRequest {
  sale_id: string
  user_id: string
  user_role: string
  user_branch_id: string
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
  user_id: string
  user_role: string
  user_branch_id: string
}

/**
 * 거래번호별 그룹화된 판매 데이터 (PurchaseGroup 구조와 동일)
 */
export interface SaleGroup {
  reference_number: string // 거래번호
  sale_date: string
  customer_name: string
  items: SaleHistory[]
  total_amount: number
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
  cost_of_goods: number
  profit: number
  message: string
}