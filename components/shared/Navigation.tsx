'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserData } from '@/types'
import { usePermissions } from '@/hooks/usePermissions'
import { ROLE_LABELS } from '@/types/permissions'

interface Props {
  user: UserData
  onLogout: () => void
}

interface MenuItem {
  href: string
  label: string
  icon: string
  resource?: string
  action?: string
}

export function Navigation({ user, onLogout }: Props) {
  const pathname = usePathname()
  const { can, isSystemAdmin } = usePermissions(user.role)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // 메뉴 항목 정의
  const menuItems: MenuItem[] = [
    {
      href: '/',
      label: '대시보드',
      icon: '📊',
    },
    {
      href: '/purchases',
      label: '입고 관리',
      icon: '📥',
      resource: 'purchases_management',
      action: 'read',
    },
    {
      href: '/sales',
      label: '판매 관리',
      icon: '📤',
      resource: 'sales_management',
      action: 'read',
    },
    {
      href: '/inventory',
      label: '재고 현황',
      icon: '📦',
      resource: 'inventory_view',
      action: 'read',
    },
    {
      href: '/clients',
      label: '거래처 관리',
      icon: '🏢',
      resource: 'clients_management',
      action: 'read',
    },
    {
      href: '/products',
      label: '품목 관리',
      icon: '📋',
      resource: 'products_management',
      action: 'read',
    },
  ]
  
  // 시스템 관리자만 보이는 메뉴
  if (isSystemAdmin()) {
    menuItems.push({
      href: '/admin/branches',
      label: '지점 관리',
      icon: '🏬',
      resource: 'branches_management',
      action: 'read',
    })
    menuItems.push({
      href: '/admin/users',
      label: '사용자 관리',
      icon: '👥',
      resource: 'users_management',
      action: 'read',
    })
  }
  
  // 권한 필터링
  const visibleMenuItems = menuItems.filter(item => {
    if (!item.resource || !item.action) return true
    return can(item.resource as any, item.action as any)
  })
  
  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition">
            <span className="text-2xl">🏥</span>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">
              DR.Evers ERP
            </h1>
          </Link>
          
          {/* 데스크탑 메뉴 (1024px+: 아이콘+텍스트, 768px-1023px: 아이콘만) */}
          <div className="hidden md:flex items-center space-x-1">
            {visibleMenuItems.map((item) => {
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition
                    ${isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className={isActive ? 'text-lg' : ''}>{item.icon}</span>
                  <span className="ml-1 hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>
          
          {/* 데스크탑 사용자 정보 */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.display_name}
              </p>
              <p className="text-xs text-gray-500">
                {ROLE_LABELS[user.role]} • {user.branch_name || '전체'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
            >
              로그아웃
            </button>
          </div>

          {/* 모바일 햄버거 버튼 (767px 이하) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* 모바일 메뉴 (767px 이하) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-1">
              {visibleMenuItems.map((item) => {
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      block px-3 py-2 rounded-md text-base font-medium transition
                      ${isActive 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="px-3 mb-3">
                <p className="text-sm font-medium text-gray-900">
                  {user.display_name}
                </p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[user.role]} • {user.branch_name || '전체'}
                </p>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  onLogout()
                }}
                className="w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}