// ============================================================
// Phase 6: Reports System - TypeScript Types
// ============================================================
// 작성일: 2025-01-26
// 목적: 구매/판매/이익 레포트 데이터 타입 정의
// 참고: database/phase6_reports_rpc_functions.sql의 RETURNS TABLE과 일치
// ============================================================

// ============================================================
// 공통 타입
// ============================================================

/**
 * 레포트 그룹핑 방식
 * - daily: 일별
 * - monthly: 월별
 * - product: 품목별
 * - supplier: 공급처별 (구매 레포트 전용)
 * - customer: 고객별 (판매 레포트 전용)
 */
export type ReportGroupBy = 'daily' | 'monthly' | 'product' | 'supplier' | 'customer'

/**
 * 레포트 필터 조건
 */
export interface ReportFilter {
  /** 조회 시작일 (YYYY-MM-DD) */
  startDate: string
  /** 조회 종료일 (YYYY-MM-DD) */
  endDate: string
  /** 그룹핑 방식 */
  groupBy: ReportGroupBy
  /** 지점 ID (선택사항, null이면 전체 지점) */
  branchId?: string | null
}

/**
 * 레포트 응답 래퍼
 */
export interface ReportResponse<T> {
  /** 성공 여부 */
  success: boolean
  /** 레포트 데이터 */
  data: T[]
  /** 오류 메시지 (실패 시) */
  error?: string
  /** 필터 조건 (요청 시 사용된 필터) */
  filter: ReportFilter
}

// ============================================================
// 구매 레포트 타입
// ============================================================

/**
 * 구매 레포트 행 데이터
 * (database/phase6_reports_rpc_functions.sql - get_purchase_report)
 */
export interface PurchaseReportRow {
  /** 그룹 키 (날짜/품목ID/공급처ID) */
  group_key: string
  /** 그룹 라벨 (화면 표시용) */
  group_label: string
  /** 총 입고 수량 */
  total_quantity: number
  /** 총 입고 금액 */
  total_amount: number
  /** 거래 건수 */
  transaction_count: number
  /** 평균 단가 (총 금액 / 총 수량) */
  average_unit_cost: number
  /** 품목 수 (그룹별 집계에서 품목 개수) */
  product_count: number
}

/**
 * 구매 레포트 응답
 */
export type PurchaseReportResponse = ReportResponse<PurchaseReportRow>

// ============================================================
// 판매 레포트 타입
// ============================================================

/**
 * 판매 레포트 행 데이터
 * (database/phase6_reports_rpc_functions.sql - get_sales_report)
 */
export interface SalesReportRow {
  /** 그룹 키 (날짜/품목ID/고객ID) */
  group_key: string
  /** 그룹 라벨 (화면 표시용) */
  group_label: string
  /** 총 판매 수량 */
  total_quantity: number
  /** 총 매출액 (total_price) */
  total_revenue: number
  /** 총 원가 (cost_of_goods_sold) */
  total_cost: number
  /** 총 이익 (profit) */
  total_profit: number
  /** 거래 건수 */
  transaction_count: number
  /** 평균 단가 (총 매출 / 총 수량) */
  average_unit_price: number
  /** 품목 수 (그룹별 집계에서 품목 개수) */
  product_count: number
}

/**
 * 판매 레포트 응답
 */
export type SalesReportResponse = ReportResponse<SalesReportRow>

// ============================================================
// 이익 레포트 타입
// ============================================================

/**
 * 이익 레포트 행 데이터
 * (database/phase6_reports_rpc_functions.sql - get_profit_report)
 */
export interface ProfitReportRow {
  /** 그룹 키 (날짜) */
  group_key: string
  /** 그룹 라벨 (화면 표시용) */
  group_label: string
  /** 총 매출액 */
  total_revenue: number
  /** 총 원가 */
  total_cost: number
  /** 총 이익 (매출 - 원가) */
  total_profit: number
  /** 이익률 (이익 / 매출 * 100) */
  profit_margin: number
  /** 거래 건수 */
  transaction_count: number
  /** 품목 수 */
  product_count: number
}

/**
 * 이익 레포트 응답
 */
export type ProfitReportResponse = ReportResponse<ProfitReportRow>

// ============================================================
// UI 상태 타입
// ============================================================

/**
 * 레포트 로딩 상태
 */
export interface ReportLoadingState {
  /** 로딩 중 여부 */
  loading: boolean
  /** 오류 메시지 */
  error: string | null
}

/**
 * 레포트 그룹핑 옵션 (UI 셀렉트용)
 */
export interface ReportGroupByOption {
  /** 옵션 값 */
  value: ReportGroupBy
  /** 옵션 라벨 */
  label: string
  /** 설명 (툴팁용) */
  description?: string
}

/**
 * 구매 레포트 그룹핑 옵션
 */
export const PURCHASE_GROUP_BY_OPTIONS: ReportGroupByOption[] = [
  { value: 'daily', label: '일별', description: '날짜별 입고 현황' },
  { value: 'monthly', label: '월별', description: '월별 입고 현황' },
  { value: 'product', label: '품목별', description: '품목별 입고 현황' },
  { value: 'supplier', label: '공급처별', description: '공급처별 입고 현황' },
]

/**
 * 판매 레포트 그룹핑 옵션
 */
export const SALES_GROUP_BY_OPTIONS: ReportGroupByOption[] = [
  { value: 'daily', label: '일별', description: '날짜별 판매 현황' },
  { value: 'monthly', label: '월별', description: '월별 판매 현황' },
  { value: 'product', label: '품목별', description: '품목별 판매 현황' },
  { value: 'customer', label: '고객별', description: '고객별 판매 현황' },
]

/**
 * 이익 레포트 그룹핑 옵션
 */
export const PROFIT_GROUP_BY_OPTIONS: ReportGroupByOption[] = [
  { value: 'daily', label: '일별', description: '날짜별 이익 현황' },
  { value: 'monthly', label: '월별', description: '월별 이익 현황' },
]
