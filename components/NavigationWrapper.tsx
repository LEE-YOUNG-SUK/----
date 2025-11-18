'use client'

import { useRouter } from 'next/navigation'
import { Navigation } from './shared/Navigation'
import { UserData } from '@/types'

interface Props {
  user: UserData
}

export function NavigationWrapper({ user }: Props) {
  const router = useRouter()
  
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }
  
  return <Navigation user={user} onLogout={handleLogout} />
}