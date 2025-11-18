import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { UserData } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { token, userData } = await request.json()
    
    if (!token || !userData) {
      return NextResponse.json(
        { error: 'Missing token or userData' },
        { status: 400 }
      )
    }
    
    const cookieStore = await cookies()
    
    // 쿠키에 토큰 저장
    cookieStore.set('erp_session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/'
    })
    
    // 사용자 데이터 저장
    cookieStore.set('erp_user_data', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/'
    })
    
    // RLS 컨텍스트 설정
    const supabase = await createServerClient()
    await supabase.rpc('set_current_user_context', {
      p_user_id: (userData as UserData).user_id,
      p_role: (userData as UserData).role,
      p_branch_id: (userData as UserData).branch_id
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('❌ Login API error:', error)
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}