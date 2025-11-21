import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    
    // 쿠키 삭제
    cookieStore.delete('erp_session_token')
    cookieStore.delete('erp_user_data')
    
    return NextResponse.json({ 
      success: true,
      message: '로그아웃 성공'
    }, {
      status: 200
    })
    
  } catch (error: any) {
    console.error('로그아웃 에러:', error)
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Logout failed' 
    }, {
      status: 500
    })
  }
}