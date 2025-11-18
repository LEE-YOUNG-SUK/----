import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 정적 파일 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }
  
  // 세션 토큰 확인
  const sessionToken = request.cookies.get('erp_session_token')
  const isLoginPage = pathname === '/login'
  
  // 로그인 페이지 처리
  if (isLoginPage) {
    // 이미 로그인되어 있으면 홈으로
    if (sessionToken) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }
  
  // 다른 모든 페이지는 로그인 필요
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}