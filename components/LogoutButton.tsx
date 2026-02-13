'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const handleLogout = async () => {
    if (loading) return
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('로그아웃 실패:', data)
        throw new Error(data.error || '로그아웃 실패')
      }
      
      // 쿠키가 삭제되었으므로 로그인 페이지로 이동
      window.location.href = '/login'
      
    } catch (error: any) {
      console.error('로그아웃 에러:', error)
      alert('로그아웃에 실패했습니다: ' + error.message)
      setLoading(false)
    }
  }
  
  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  )
}