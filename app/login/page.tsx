'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

interface Branch {
  id: string
  code: string
  name: string
}

export default function LoginPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [formData, setFormData] = useState({
    branch_id: '',
    username: '',
    password: ''
  })
  const [rememberBranch, setRememberBranch] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [error, setError] = useState('')

  // 지점 목록 로드 + 마지막 지점 복원
  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = async () => {
    try {
      setLoadingBranches(true)
      
      const { data, error } = await supabase.rpc('get_branches_for_login')
      
      if (error) {
        console.error('지점 목록 조회 실패:', error)
        return
      }
      
      setBranches(data || [])
      
      // localStorage에서 마지막 지점 복원
      const lastBranchId = localStorage.getItem('last_branch_id')
      const lastUsername = localStorage.getItem('last_username')
      
      if (lastBranchId) {
        setFormData(prev => ({ 
          ...prev, 
          branch_id: lastBranchId,
          username: lastUsername || ''
        }))
      }
    } catch (err) {
      console.error('지점 목록 로드 에러:', err)
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.branch_id) {
      setError('지점을 선택해주세요.')
      return
    }
    
    if (!formData.username.trim()) {
      setError('아이디를 입력해주세요.')
      return
    }
    
    if (!formData.password) {
      setError('비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 로그인 검증 (지점 포함)
      const { data: loginResult, error: loginError } = await supabase.rpc('verify_login', {
        p_username: formData.username.trim(),
        p_password: formData.password,
        p_branch_id: formData.branch_id
      })

      if (loginError) {
        setError('로그인 중 오류가 발생했습니다.')
        console.error('로그인 에러:', loginError)
        return
      }

      const result = loginResult?.[0]
      if (!result?.success) {
        setError(result?.message || '로그인에 실패했습니다.')
        return
      }

      // 세션 생성 (서버 측에서 토큰 생성 + 만료시간 설정)
      const { data: sessionData, error: sessionError } = await supabase.rpc('create_session', {
        p_user_id: result.user_id
      })

      if (sessionError || !sessionData || sessionData.length === 0) {
        setError('세션 생성 중 오류가 발생했습니다.')
        console.error('세션 에러:', sessionError)
        return
      }

      const token = sessionData[0].token

      // 쿠키에 세션 토큰 저장
      document.cookie = `erp_session_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`

      // 지점 정보 기억하기
      if (rememberBranch) {
        localStorage.setItem('last_branch_id', formData.branch_id)
        localStorage.setItem('last_username', formData.username.trim())
      } else {
        localStorage.removeItem('last_branch_id')
        localStorage.removeItem('last_username')
      }

      // 로그인 성공 - 대시보드로 이동
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('로그인 처리 에러:', err)
      setError('로그인 중 오류가 발생했습니다.')
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
            <div className="mb-1 flex justify-center">
              <Image src="/logo.png" alt="DR.Evers ERP" width={300} height={80} priority />
            </div>
            <p className="mt-0 text-2xl text-gray-900 font-medium">
              &nbsp;&nbsp;재고관리 시스템
            </p>
          </div>
          
          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 지점 선택 */}
            <div>
              <label htmlFor="branch" className="block text-sm font-medium text-gray-900 mb-2">
                🏢 지점 선택
              </label>
              <select
                id="branch"
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                disabled={loadingBranches}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition appearance-none bg-white"
                required
              >
                <option value="">
                  {loadingBranches ? '지점 목록 로딩 중...' : '지점을 선택하세요'}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 아이디 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-900 mb-2">
                👤 아이디
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="아이디를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                autoComplete="username"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                🔒 비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                autoComplete="current-password"
              />
            </div>

            {/* 지점 기억하기 체크박스 */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberBranch}
                onChange={(e) => setRememberBranch(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-900">
                지점 정보 기억하기
              </label>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">
                  ❌ {error}
                </p>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading || loadingBranches}
              className={`w-full py-3 px-4 text-white font-medium rounded-lg transition flex items-center justify-center ${
                loading || loadingBranches
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* 하단 안내 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-900 text-sm font-medium mb-2">
              💡 안내
            </p>
            <p className="text-blue-800 text-xs">
              • 동일한 아이디가 다른 지점에 존재할 수 있습니다
            </p>
            <p className="text-blue-800 text-xs">
              • 반드시 소속 지점을 선택한 후 로그인하세요
            </p>
          </div>
        </div>
        
        <p className="mt-6 text-center text-sm text-gray-900">
          © 2025 DR.Evers. All rights reserved.
        </p>
      </div>
    </div>
  )
}

