import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 정적 파일 및 API 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
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
  
  // 정상적으로 페이지 접근 허용
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}