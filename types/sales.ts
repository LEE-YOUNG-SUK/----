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

// 고객 (거래처)
export interface Customer {
  id: string
  code: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
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