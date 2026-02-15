import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getSafeErrorMessage, logServerError } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  try {
    const { username, password, branch_id } = await request.json()

    if (!username || !password || !branch_id) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // 1. 로그인 검증
    const { data: loginResult, error: loginError } = await supabase.rpc('verify_login', {
      p_username: username.trim(),
      p_password: password,
      p_branch_id: branch_id
    })

    if (loginError) {
      return NextResponse.json(
        { success: false, message: '로그인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const result = loginResult?.[0]
    if (!result?.success) {
      return NextResponse.json(
        { success: false, message: result?.message || '로그인에 실패했습니다.' },
        { status: 401 }
      )
    }

    // 2. 세션 생성
    const { data: sessionData, error: sessionError } = await supabase.rpc('create_session', {
      p_user_id: result.user_id
    })

    if (sessionError || !sessionData || sessionData.length === 0) {
      return NextResponse.json(
        { success: false, message: '세션 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const token = sessionData[0].token

    // 3. httpOnly 쿠키 설정 (서버에서만 가능)
    const cookieStore = await cookies()

    cookieStore.set('erp_session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/'
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    logServerError('Login API', error)
    return NextResponse.json(
      { success: false, message: getSafeErrorMessage(error, '로그인에 실패했습니다') },
      { status: 500 }
    )
  }
}
