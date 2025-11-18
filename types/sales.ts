// types/sales.ts
export interface SaleRow {
  id: string;
  product_code: string;
  product_name: string;
  specification: string;
  manufacturer: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  current_stock: number; // 현재 재고
  cost_of_goods?: number; // FIFO 원가 (저장 후)
  profit?: number; // 이익 (저장 후)
}

export interface SaleFormData {
  branch_id: string;
  customer_id: string;
  sale_date: string;
  reference_number?: string;
  notes?: string;
  items: SaleRow[];
}

export interface SaleHistory {
  id: string;
  sale_date: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  cost_of_goods: number;
  profit: number;
  profit_rate: number;
  reference_number?: string;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface ProductWithStock {
  id: string;
  code: string;
  name: string;
  specification: string;
  manufacturer: string;
  unit: string;
  standard_sale_price: number;
  current_stock: number; // 현재 재고 수량
}