/**
 * 안전한 에러 핸들링 유틸리티
 * 민감한 DB 정보가 클라이언트에 노출되지 않도록 처리
 */

// 사용자에게 보여줄 수 있는 안전한 에러 메시지 매핑
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  // 인증 관련
  'Invalid login credentials': '로그인 정보가 올바르지 않습니다',
  'JWT expired': '세션이 만료되었습니다. 다시 로그인해주세요',
  'Invalid token': '인증 정보가 유효하지 않습니다',

  // 권한 관련
  'permission denied': '권한이 없습니다',
  'insufficient_privilege': '권한이 부족합니다',

  // 데이터 무결성
  'duplicate key': '이미 존재하는 데이터입니다',
  'violates foreign key': '연결된 데이터가 있어 처리할 수 없습니다',
  'violates not-null': '필수 항목을 입력해주세요',
  'violates check constraint': '입력값이 유효하지 않습니다',

  // 재고 관련
  'insufficient stock': '재고가 부족합니다',
  'negative inventory': '재고가 부족합니다',
}

/**
 * 에러 메시지에서 민감한 정보를 제거하고 사용자 친화적인 메시지 반환
 */
export function getSafeErrorMessage(error: unknown, defaultMessage: string): string {
  if (!error) return defaultMessage

  const errorMessage = error instanceof Error ? error.message : String(error)

  // 안전한 에러 메시지 매핑 확인
  for (const [pattern, safeMessage] of Object.entries(SAFE_ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return safeMessage
    }
  }

  // 개발 환경에서는 상세 에러 표시 (디버깅용)
  if (process.env.NODE_ENV === 'development') {
    return errorMessage
  }

  // 프로덕션에서는 기본 메시지 반환 (민감 정보 보호)
  return defaultMessage
}

/**
 * 서버 로깅용 - 안전한 에러 정보 기록
 */
export function logServerError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error)
  } else {
    console.error(`[${context}]`, error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * API 응답용 에러 객체 생성
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string,
  context?: string
): { success: false; message: string } {
  if (context) {
    logServerError(context, error)
  }

  return {
    success: false,
    message: getSafeErrorMessage(error, defaultMessage)
  }
}
