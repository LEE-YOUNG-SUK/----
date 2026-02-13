// 재고 현황 아이템
export interface InventoryItem {
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  category: string | null
  current_quantity: number
  layer_count: number
  oldest_purchase_date: string | null
  newest_purchase_date: string | null
  avg_unit_cost: number | null
  stock_status?: string
  min_stock_level?: number
}

// 재고 요약 통계
export interface InventorySummary {
  total_products: number
  total_quantity: number
  total_value: number
  low_stock_count: number
  out_of_stock_count: number
}

// 재고 현황 (가중평균 기반)
export interface InventoryStatusItem {
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  category: string | null
  current_quantity: number
  weighted_avg_cost: number
  inventory_value: number
  layer_count: number
  oldest_purchase_date: string | null
  newest_purchase_date: string | null
  min_stock_level: number | null
}

// FIFO 레이어 상세
export interface InventoryLayer {
  layer_id: string
  purchase_date: string
  unit_cost: number
  original_quantity: number
  consumed_quantity: number
  remaining_quantity: number
  layer_value: number
  reference_number: string | null
}

// 재고 입출고 내역
export interface InventoryMovement {
  movement_date: string
  movement_type: string
  party_name: string | null
  remarks: string | null
  incoming_qty: number
  outgoing_qty: number
  running_balance: number
  reference_number: string | null
}

// 입/출고 상세조회 (개별 거래)
export interface MovementDetail {
  movement_date: string
  movement_type: string
  reference_number: string | null
  product_code: string
  product_name: string
  unit: string
  quantity: number
  supply_price: number
  tax_amount: number
  total_price: number
  party_name: string | null
  remarks: string | null
}

// 재고 상태 타입
export type StockStatus = '정상' | '부족' | '재고없음'

// 재고 상태 계산 함수
export function calculateStockStatus(
  currentQuantity: number,
  minStockLevel: number = 0
): StockStatus {
  if (currentQuantity === 0) return '재고없음'
  if (currentQuantity <= minStockLevel) return '부족'
  return '정상'
}

// 재고 상태별 색상
export const STOCK_STATUS_COLORS = {
  '정상': {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800'
  },
  '부족': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800'
  },
  '재고없음': {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800'
  }
}

// 재고 상태 아이콘
export const STOCK_STATUS_ICONS = {
  '정상': '✅',
  '부족': '⚠️',
  '재고없음': '🚨'
}