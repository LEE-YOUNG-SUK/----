/**
 * 감사로그 필드명을 한글로 매핑
 */

export const FIELD_LABELS: Record<string, string> = {
  // 공통 필드
  'product_id': '품목 ID',
  'product_name': '품목명',
  'quantity': '수량',
  'unit_price': '단가',
  'supply_price': '공급가',
  'tax_amount': '부가세',
  'total_price': '합계금액',
  'total_cost': '합계금액',
  'reference_note': '참조사항',
  'purchase_date': '입고일',
  'sale_date': '판매일',
  'status': '상태',
  
  // 입고 전용
  'client_id': '거래처',
  'supplier_id': '공급업체',
  
  // 판매 전용
  'customer_id': '고객',
  
  // 재고 조정 전용
  'adjustment_type': '조정 유형',
  'adjustment_reason': '조정 사유',
  'adjustment_date': '조정일',
  'reference_number': '참조 번호',
  'notes': '비고',
  'is_cancelled': '취소 여부',
  'cancelled_by': '취소자',
  'cancelled_at': '취소일시',
  
  // 기타
  'branch_id': '지점',
  'user_id': '담당자',
  'created_at': '생성일시',
  'updated_at': '수정일시',
}

/**
 * 필드명을 한글로 변환
 */
export function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName
}

/**
 * 여러 필드명을 한글로 변환
 */
export function getFieldLabels(fieldNames: string[]): string[] {
  return fieldNames.map(getFieldLabel)
}
