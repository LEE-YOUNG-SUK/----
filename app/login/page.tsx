'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const { data, error: rpcError } = await supabase.rpc('authenticate_user', {
        p_username: username,
        p_password: password,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      })
      
      if (rpcError) throw new Error(rpcError.message)
      if (!data || data.length === 0) throw new Error('서버 응답 없음')
      
      const result = data[0]
      if (!result.success) throw new Error(result.message)
      
      // 2. 세션 저장
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.token,
          userData: {
            user_id: result.user_id,
            username: username,
            display_name: result.display_name,
            role: result.role,
            branch_id: result.branch_id || null,
            branch_name: result.branch_name || null
          }
        })
      })
      
      if (!res.ok) throw new Error('세션 저장 실패')
      
      // 3. 페이지 이동
      window.location.href = '/'
      
    } catch (err: any) {
      console.error('❌ 로그인 실패:', err)
      setError(err.message || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-blue-50 rounded-full mb-4">
              <span className="text-4xl">🏥</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              DR.Evers ERP
            </h1>
            <p className="mt-2 text-gray-600">
              재고관리 시스템
            </p>
          </div>
          
          {/* 폼 */}
          <form onSubmit={handleSubmit}>
            {/* 아이디 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                아이디
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={loading}
                placeholder="아이디를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition"
              />
            </div>
            
            {/* 비밀번호 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition"
              />
            </div>
            
            {/* 에러 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 text-sm">
                  ❌ {error}
                </p>
              </div>
            )}
            
            {/* 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 text-white font-medium rounded-lg transition ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
          
          {/* 안내 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-900 text-sm font-medium mb-2">
              💡 초기 관리자 계정
            </p>
            <p className="text-blue-800 text-sm my-1">
              아이디: <code className="bg-blue-100 px-2 py-0.5 rounded">admin</code>
            </p>
            <p className="text-blue-800 text-sm my-1">
              비밀번호: <code className="bg-blue-100 px-2 py-0.5 rounded">admin1234</code>
            </p>
          </div>
        </div>
        
        <p className="mt-6 text-center text-sm text-gray-600">
          Next.js 16 + TypeScript + Supabase
        </p>
      </div>
    </div>
  )
}