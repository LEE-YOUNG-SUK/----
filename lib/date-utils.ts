const MAX_RANGE_DAYS = 365

/**
 * 조회 기간 검증 (최대 365일)
 * @returns 유효하면 null, 아니면 에러 메시지
 */
export function validateDateRange(
  startDate?: string | null,
  endDate?: string | null
): string | null {
  if (!startDate || !endDate) return null

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return '유효하지 않은 날짜 형식입니다.'
  }

  if (start > end) {
    return '시작일이 종료일보다 클 수 없습니다.'
  }

  const diffMs = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > MAX_RANGE_DAYS) {
    return `조회 기간은 최대 ${MAX_RANGE_DAYS}일까지 가능합니다.`
  }

  return null
}
