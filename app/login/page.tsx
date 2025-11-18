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
      console.log('🔐 로그인 시도:', username)
      
      // 1. Supabase 인증
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
      
      console.log('✅ 인증 성공')
      
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
      
      console.log('✅ 세션 저장 완료')
      
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom right, #dbeafe, #e0e7ff, #f3e8ff)'
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        margin: '0 1rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '2rem'
        }}>
          {/* 헤더 */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-block',
              padding: '0.75rem',
              background: '#dbeafe',
              borderRadius: '9999px',
              marginBottom: '1rem'
            }}>
              <span style={{ fontSize: '2.5rem' }}>🏥</span>
            </div>
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0
            }}>
              DR.Evers ERP
            </h1>
            <p style={{
              marginTop: '0.5rem',
              color: '#6b7280',
              margin: '0.5rem 0 0 0'
            }}>
              재고관리 시스템
            </p>
          </div>
          
          {/* 폼 */}
          <form onSubmit={handleSubmit}>
            {/* 아이디 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
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
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* 비밀번호 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="비밀번호를 입력하세요"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* 에러 */}
            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{
                  color: '#991b1b',
                  fontSize: '0.875rem',
                  margin: 0
                }}>
                  ❌ {error}
                </p>
              </div>
            )}
            
            {/* 버튼 */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: loading ? '#9ca3af' : '#2563eb',
                color: 'white',
                fontWeight: '500',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem'
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
          
          {/* 안내 */}
          <div style={{
            marginTop: '2rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.5rem',
            padding: '1rem'
          }}>
            <p style={{
              color: '#1e40af',
              fontSize: '0.875rem',
              fontWeight: '500',
              margin: '0 0 0.5rem 0'
            }}>
              💡 초기 관리자 계정
            </p>
            <p style={{
              color: '#1e40af',
              fontSize: '0.875rem',
              margin: '0.25rem 0'
            }}>
              아이디: <code style={{
                background: '#dbeafe',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem'
              }}>admin</code>
            </p>
            <p style={{
              color: '#1e40af',
              fontSize: '0.875rem',
              margin: '0.25rem 0'
            }}>
              비밀번호: <code style={{
                background: '#dbeafe',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem'
              }}>admin1234</code>
            </p>
          </div>
        </div>
        
        <p style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          Next.js 15 + TypeScript + Supabase
        </p>
      </div>
    </div>
  )
}