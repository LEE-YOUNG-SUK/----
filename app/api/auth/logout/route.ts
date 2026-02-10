import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getSafeErrorMessage, logServerError } from '@/lib/error-handler'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('erp_session_token')?.value

    // DB 세션 무효화
    if (token) {
      const supabase = await createServerClient()
      await supabase
        .from('sessions')
        .update({ is_valid: false })
        .eq('token', token)
    }

    // 쿠키 삭제
    cookieStore.delete('erp_session_token')
    cookieStore.delete('erp_user_data')

    return NextResponse.json({
      success: true,
      message: '로그아웃 성공'
    }, {
      status: 200
    })

  } catch (error) {
    logServerError('Logout API', error)

    return NextResponse.json({
      success: false,
      error: getSafeErrorMessage(error, '로그아웃에 실패했습니다')
    }, {
      status: 500
    })
  }
}