// types/b2b.ts
// B2B 발주 시스템 타입 정의

// =====================================================
// 상태 타입
// =====================================================

export type B2bOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'on_hold'
  | 'partially_shipped'
  | 'shipped'
  | 'partially_settled'
  | 'settled'
  | 'completed'
  | 'canceled'

export type B2bStatementStatus = 'draft' | 'issued' | 'canceled'

export type B2bTaxInvoiceStatus = 'pending' | 'requested' | 'issued' | 'failed' | 'canceled'

export type B2bSettlementDirection = 'receivable' | 'payable'

// =====================================================
// 상태 라벨/색상 매핑
// =====================================================

export const B2B_ORDER_STATUS_LABELS: Record<B2bOrderStatus, string> = {
  draft: '임시저장',
  pending_approval: '승인대기',
  approved: '승인완료',
  on_hold: '보류',
  partially_shipped: '부분출고',
  shipped: '출고완료',
  partially_settled: '부분정산',
  settled: '정산완료',
  completed: '완료',
  canceled: '취소',
}

export const B2B_ORDER_STATUS_COLORS: Record<B2bOrderStatus, 'default' | 'warning' | 'success' | 'danger' | 'secondary'> = {
  draft: 'secondary',
  pending_approval: 'warning',
  approved: 'success',
  on_hold: 'danger',
  partially_shipped: 'warning',
  shipped: 'success',
  partially_settled: 'warning',
  settled: 'success',
  completed: 'default',
  canceled: 'danger',
}

export const B2B_STATEMENT_STATUS_LABELS: Record<B2bStatementStatus, string> = {
  draft: '초안',
  issued: '발행됨',
  canceled: '취소됨',
}

export const B2B_TAX_INVOICE_STATUS_LABELS: Record<B2bTaxInvoiceStatus, string> = {
  pending: '대기',
  requested: '발행요청',
  issued: '발행완료',
  failed: '발행실패',
  canceled: '취소',
}

export const B2B_SETTLEMENT_DIRECTION_LABELS: Record<B2bSettlementDirection, string> = {
  receivable: '수금 (본사)',
  payable: '지급 (지점)',
}

// =====================================================
// 상태 전이 규칙
// =====================================================

export const B2B_ORDER_TRANSITIONS: Record<B2bOrderStatus, B2bOrderStatus[]> = {
  draft: ['pending_approval', 'canceled'],
  pending_approval: ['approved', 'on_hold', 'canceled'],
  approved: ['partially_shipped', 'shipped', 'on_hold', 'canceled'],
  on_hold: ['approved', 'canceled'],
  partially_shipped: ['shipped', 'on_hold'],
  shipped: ['partially_settled', 'settled'],
  partially_settled: ['settled'],
  settled: ['completed'],
  completed: [],
  canceled: [],
}

// =====================================================
// 데이터 인터페이스
// =====================================================

// 주문 헤더
export interface B2bOrder {
  id: string
  order_number: string
  branch_id: string
  branch_name?: string
  ordered_by: string
  ordered_by_name?: string
  status: B2bOrderStatus
  total_supply_price: number
  total_tax_amount: number
  total_price: number
  shipping_progress: number
  settlement_progress: number
  memo: string | null
  approved_by: string | null
  approved_at: string | null
  canceled_by: string | null
  canceled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
  item_count?: number
}

// 주문 아이템
export interface B2bOrderItem {
  id: string
  order_id: string
  product_id: string
  product_code?: string
  product_name?: string
  unit?: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  shipped_quantity: number
  settled_amount: number
  memo: string | null
  created_at: string
}

// 주문 상세 (아이템 + 이력 포함)
export interface B2bOrderDetail {
  order: B2bOrder
  branch: {
    id: string
    name: string
    code: string
    business_number: string | null
    address: string | null
    phone: string | null
  }
  ordered_by: {
    id: string
    display_name: string
  }
  items: B2bOrderItemDetail[]
  status_history: B2bOrderStatusHistory[]
  shipments?: B2bShipment[]
  statements?: B2bTransactionStatement[]
  settlements?: B2bSettlement[]
}

// 주문 아이템 상세 (잔여수량 계산용)
export interface B2bOrderItemDetail extends B2bOrderItem {
  remaining_quantity: number   // quantity - shipped_quantity
  remaining_amount: number     // total_price - settled_amount
}

// 장바구니 아이템 (클라이언트 전용)
export interface B2bCartItem {
  product_id: string
  product_code: string
  product_name: string
  unit: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  memo: string
}

// 상태 전이 이력
export interface B2bOrderStatusHistory {
  id?: string
  order_id?: string
  from_status: B2bOrderStatus | null
  to_status: B2bOrderStatus
  changed_by_name: string
  reason: string | null
  created_at: string
}

// =====================================================
// 배송/출고
// =====================================================

export interface B2bShipment {
  id: string
  order_id: string
  shipment_number: string
  shipped_at: string
  courier: string | null
  tracking_number: string | null
  receipt_confirmed: boolean
  receipt_confirmed_at: string | null
  receipt_confirmed_by: string | null
  receipt_confirmed_by_name?: string
  shipped_by: string
  shipped_by_name?: string
  memo: string | null
  created_at: string
  items?: B2bShipmentItem[]
}

export interface B2bShipmentItem {
  id: string
  shipment_id: string
  order_item_id: string
  product_code?: string
  product_name?: string
  unit?: string
  quantity: number
  created_at: string
}

// =====================================================
// 거래명세서
// =====================================================

export interface B2bTransactionStatement {
  id: string
  statement_number: string
  order_id: string
  order_number?: string
  status: B2bStatementStatus
  issued_at: string | null
  issued_by: string | null
  issued_by_name?: string
  total_supply_price: number
  total_tax_amount: number
  total_price: number
  statement_data: B2bStatementData | null
  reissue_count: number
  reissue_history: B2bReissueRecord[]
  canceled_at: string | null
  canceled_by: string | null
  cancel_reason: string | null
  memo: string | null
  created_by: string
  created_at: string
  updated_at: string
  items?: B2bStatementItem[]
}

export interface B2bStatementItem {
  id: string
  statement_id: string
  order_item_id: string
  product_id: string
  product_code?: string
  product_name?: string
  unit?: string
  quantity: number
  unit_price: number
  supply_price: number
  tax_amount: number
  total_price: number
  created_at: string
}

// 인쇄용 스냅샷 데이터
export interface B2bStatementData {
  provider: {
    name: string
    business_number: string | null
    address: string | null
    phone: string | null
  }
  receiver: {
    name: string
    business_number: string | null
    address: string | null
    phone: string | null
  }
  items: {
    product_code: string
    product_name: string
    unit: string
    quantity: number
    unit_price: number
    supply_price: number
    tax_amount: number
    total_price: number
  }[]
  totals: {
    supply_price: number
    tax_amount: number
    total_price: number
  }
  issue_date: string
  statement_number: string
  issued_by_name: string
}

export interface B2bReissueRecord {
  at: string
  by: string
  reason: string
}

// =====================================================
// 정산
// =====================================================

export interface B2bSettlement {
  id: string
  settlement_number: string
  order_id: string
  order_number?: string
  statement_id: string | null
  direction: B2bSettlementDirection
  amount: number
  settlement_date: string
  method: string | null
  reference_number: string | null
  memo: string | null
  settled_by: string
  settled_by_name?: string
  created_at: string
}

export interface B2bSettlementSummary {
  total_price: number
  total_settled: number
  remaining: number
  settlement_progress: number
}

// =====================================================
// 세금계산서
// =====================================================

export interface B2bTaxInvoice {
  id: string
  invoice_number: string
  order_id: string
  order_number?: string
  branch_id: string
  branch_name?: string
  status: B2bTaxInvoiceStatus
  supply_price: number
  tax_amount: number
  total_price: number
  issue_date: string | null
  provider_id: string | null
  requested_at: string | null
  issued_at: string | null
  failed_at: string | null
  failure_reason: string | null
  memo: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// =====================================================
// 리포트 타입
// =====================================================

// 미수 리포트 항목
export interface B2bOutstandingReportItem {
  order_id: string
  order_number: string
  branch_id: string
  branch_name: string
  total_price: number
  settled_amount: number
  outstanding_amount: number
  settlement_rate: number
  aging_days: number
  created_at: string
}

// 정산 리포트 항목 (지점별 집계)
export interface B2bSettlementReportItem {
  branch_id: string
  branch_name: string
  total_orders: number
  total_amount: number
  total_settled: number
  total_outstanding: number
  settlement_rate: number
}

// 대시보드 통계
export interface B2bDashboardStats {
  pending_orders: number
  active_orders: number
  total_outstanding: number
  monthly_sales: number
}

// =====================================================
// 요청/응답 타입
// =====================================================

export interface B2bCreateOrderRequest {
  branch_id: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
  memo?: string
}

export interface B2bOrderFilters {
  status?: B2bOrderStatus | null
  branch_id?: string | null
  from_date?: string | null
  to_date?: string | null
}

export interface B2bCreateShipmentRequest {
  order_id: string
  items: {
    order_item_id: string
    quantity: number
  }[]
  courier?: string
  tracking_number?: string
  memo?: string
}

export interface B2bCreateStatementRequest {
  order_id: string
  items: {
    order_item_id: string
    quantity: number
  }[]
  memo?: string
}

export interface B2bCreateSettlementRequest {
  order_id: string
  amount: number
  direction: B2bSettlementDirection
  method?: string
  reference_number?: string
  statement_id?: string
  memo?: string
}

export interface B2bReportFilters {
  from_date?: string | null
  to_date?: string | null
  branch_id?: string | null
}
