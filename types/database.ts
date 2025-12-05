/**
 * Database Types
 * DB 테이블과 1:1 대응되는 타입 정의
 * 작성일: 2025-12-05
 * 
 * ⚠️ 주의: 이 파일의 타입은 실제 DB 컬럼과 정확히 일치해야 합니다.
 */

// ============================================
// sessions 테이블
// ============================================
export interface DbSession {
  id: string              // uuid
  user_id: string         // uuid, FK -> users
  token: string           // unique
  is_valid: boolean
  created_at: string      // timestamptz
  expires_at: string      // timestamptz
  last_activity: string   // timestamptz
}

// ============================================
// clients 테이블 (거래처)
// ============================================
export interface DbClient {
  id: string              // uuid
  code: string            // unique
  name: string
  type: 'supplier' | 'customer' | 'both'
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string      // timestamptz
  updated_at: string      // timestamptz
}

// ============================================
// products 테이블 (품목)
// ============================================
export interface DbProduct {
  id: string              // uuid
  code: string            // unique
  name: string
  category: string | null
  unit: string
  specification: string | null
  manufacturer: string | null
  barcode: string | null
  min_stock_level: number | null    // integer
  standard_purchase_price: number | null  // numeric(15,2)
  standard_sale_price: number | null      // numeric(15,2)
  is_active: boolean
  created_at: string      // timestamptz
  updated_at: string      // timestamptz
}

// ============================================
// purchases 테이블 (입고)
// ✅ VAT 컬럼 포함
// ============================================
export interface DbPurchase {
  id: string              // uuid
  branch_id: string       // uuid, FK -> branches
  client_id: string       // uuid, FK -> clients (NOT NULL)
  product_id: string      // uuid, FK -> products
  purchase_date: string   // date (YYYY-MM-DD)
  quantity: number        // integer
  unit_cost: number       // numeric(15,2) - 입고 단가
  supply_price: number    // numeric(15,2) - 공급가
  tax_amount: number      // numeric(15,2) - 부가세
  total_price: number     // numeric(15,2) - 합계
  total_cost: number | null  // numeric(15,2) - 기존 호환
  reference_number: string | null  // varchar(50)
  notes: string | null
  created_at: string      // timestamptz
  updated_at: string      // timestamptz
  created_by: string | null  // uuid, FK -> users
  updated_by: string | null
}

// ============================================
// sales 테이블 (판매)
// ✅ VAT 컬럼 포함
// ============================================
export interface DbSale {
  id: string              // uuid
  branch_id: string       // uuid, FK -> branches
  client_id: string | null  // uuid, FK -> clients (NULL 허용!)
  product_id: string      // uuid, FK -> products
  sale_date: string       // date (YYYY-MM-DD)
  quantity: number        // integer
  unit_price: number      // numeric(15,2) - 판매 단가
  supply_price: number    // numeric(15,2) - 공급가
  tax_amount: number      // numeric(15,2) - 부가세
  total_price: number     // numeric(15,2) - 합계
  unit_cogs: number | null       // numeric(15,2)
  total_cogs: number | null      // numeric(15,2)
  cost_of_goods_sold: number | null  // numeric(15,2) - FIFO 원가
  profit: number | null          // numeric(15,2) - 이익
  reference_number: string | null  // varchar(50)
  notes: string | null
  created_at: string      // timestamptz
  updated_at: string      // timestamptz
  created_by: string | null  // uuid, FK -> users
  updated_by: string | null
}

// ============================================
// inventory_layers 테이블 (FIFO 재고 레이어)
// ============================================
export interface DbInventoryLayer {
  id: string              // uuid
  branch_id: string       // uuid, FK -> branches
  product_id: string      // uuid, FK -> products
  purchase_id: string | null  // uuid, FK -> purchases
  purchase_date: string   // date
  unit_cost: number       // numeric(15,2)
  original_quantity: number   // integer
  remaining_quantity: number  // integer (마이너스 가능)
  source_type: 'PURCHASE' | 'ADJUSTMENT' | null
  source_id: string | null    // uuid
  created_at: string      // timestamptz
  updated_at: string      // timestamptz
}

// ============================================
// inventory_adjustments 테이블 (재고 조정)
// ✅ 2025-12-05: 실제 DB 구조에 맞게 수정
// ============================================
export interface DbInventoryAdjustment {
  id: string              // uuid
  branch_id: string       // uuid, FK -> branches
  product_id: string      // uuid, FK -> products
  adjustment_type: 'INCREASE' | 'DECREASE'
  adjustment_reason: string   // 조정 사유 (실사, 불량, 분실, 반품, 기타)
  quantity: number        // numeric
  unit: string            // 단위
  unit_cost: number | null    // numeric (nullable)
  supply_price: number | null // numeric - 공급가
  tax_amount: number | null   // numeric - 부가세
  total_cost: number | null   // numeric - 합계
  adjustment_date: string     // date
  notes: string | null
  reference_number: string | null
  created_by: string      // uuid, FK -> users (NOT NULL)
  created_at: string      // timestamptz
  is_cancelled: boolean   // 취소 여부
  cancelled_by: string | null  // uuid
  cancelled_at: string | null  // timestamptz
  cancel_reason: string | null
}

// ============================================
// audit_logs 테이블 (감사 로그)
// ============================================
export interface DbAuditLog {
  id: string              // uuid
  table_name: string      // 대상 테이블
  record_id: string       // uuid, 대상 레코드 ID
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_fields: Record<string, any> | null  // jsonb
  old_values: Record<string, any> | null      // jsonb
  new_values: Record<string, any> | null      // jsonb
  user_id: string | null  // uuid, FK -> users
  user_name: string | null
  branch_id: string | null  // uuid, FK -> branches
  branch_name: string | null
  product_name: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string      // timestamptz
}


// ============================================
// RPC 함수 파라미터 타입
// ============================================

// get_purchases_list 파라미터
export interface GetPurchasesListParams {
  p_branch_id?: string | null   // text (UUID 문자열)
  p_start_date?: string | null  // date (YYYY-MM-DD)
  p_end_date?: string | null    // date (YYYY-MM-DD)
  p_user_id?: string | null     // uuid
}

// get_sales_list 파라미터
export interface GetSalesListParams {
  p_branch_id?: string | null   // text (UUID 문자열)
  p_start_date?: string | null  // date (YYYY-MM-DD)
  p_end_date?: string | null    // date (YYYY-MM-DD)
  p_user_id?: string | null     // text ⚠️ purchases와 타입 다름!
}

// process_batch_purchase 파라미터
export interface ProcessBatchPurchaseParams {
  p_branch_id: string           // uuid
  p_client_id: string           // uuid
  p_purchase_date: string       // date
  p_reference_number: string | null
  p_notes: string | null
  p_created_by: string          // uuid
  p_items: BatchPurchaseItem[]  // jsonb
}

// process_batch_sale 파라미터
export interface ProcessBatchSaleParams {
  p_branch_id: string           // uuid
  p_client_id: string           // uuid
  p_sale_date: string           // date
  p_reference_number: string | null
  p_notes: string | null
  p_created_by: string          // uuid
  p_items: BatchSaleItem[]      // jsonb
}

// 배치 입고 아이템
export interface BatchPurchaseItem {
  product_id: string            // uuid
  quantity: number
  unit_cost: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes?: string
}

// 배치 판매 아이템
export interface BatchSaleItem {
  product_id: string            // uuid
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes?: string
}


// ============================================
// RPC 함수 응답 타입
// ============================================

// get_purchases_list 응답
export interface PurchaseListItem {
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
  supply_price: number
  tax_amount: number
  total_price: number
  total_cost: number
  reference_number: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

// get_sales_list 응답
export interface SaleListItem {
  id: string
  branch_id: string
  branch_name: string
  client_id: string | null
  customer_name: string | null
  product_id: string
  product_code: string
  product_name: string
  unit: string
  sale_date: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  total_amount: number
  cost_of_goods: number | null
  profit: number | null
  profit_margin: number | null
  reference_number: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

// 배치 처리 응답
export interface BatchProcessResponse {
  success: boolean
  message: string
  transaction_number: string | null
  purchase_ids?: string[]
  sale_ids?: string[]
  total_items: number
  total_amount: number
  total_cost?: number
  total_profit?: number
}

