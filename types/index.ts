// types/index.ts

/**
 * 공통 타입 정의
 */

// 사용자 (간단한 버전)
export interface User {
  id: string
  username: string
  display_name: string
  role: '0000' | '0001' | '0002' | '0003'
  branch_id: string | null
}

// 사용자 데이터 (전체 버전)
export interface UserData {
  user_id: string
  username: string
  display_name: string
  role: string
  branch_id: string | null
  branch_name: string | null
}

// 세션 데이터
export interface SessionData extends UserData {
  token: string
}

// 지점
export interface Branch {
  id: string
  code: string
  name: string
  address: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  business_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// 거래처
export interface Client {
  id: string
  code: string
  name: string
  type: 'supplier' | 'customer' | 'both'
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// 품목 카테고리
export interface ProductCategory {
  id: string
  code: string
  name: string
  description?: string | null
  display_order: number
  is_active: boolean
}

// 품목
export interface Product {
  id: string
  code: string
  name: string
  category_id: string | null
  category_code?: string | null  // JOIN 결과
  category_name?: string | null  // JOIN 결과
  category?: string | null       // 하위 호환 (구 버전)
  unit: string
  specification: string | null
  manufacturer: string | null
  barcode: string | null
  min_stock_level: number | null
  standard_purchase_price: number | null
  standard_sale_price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}