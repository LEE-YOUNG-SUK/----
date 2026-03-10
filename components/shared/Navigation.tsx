'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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

interface DropdownMenu {
  label: string
  icon: string
  items: MenuItem[]
}

export function Navigation({ user, onLogout }: Props) {
  const pathname = usePathname()
  const { can, isSystemAdmin } = usePermissions(user.role)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseEnter = (menu: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setOpenDropdown(menu)
  }

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null)
    }, 150)
  }
  
  // 일반 메뉴 항목 (순서: 대시보드, 품목)
  const mainMenuItems: MenuItem[] = [
    {
      href: '/',
      label: '대시보드',
      icon: '📊',
    },
    {
      href: '/products',
      label: '품목',
      icon: '📋',
      resource: 'products_management',
      action: 'read',
    },
  ]

  // 재고 드롭다운 메뉴
  const inventoryMenu: DropdownMenu = {
    label: '재고',
    icon: '📦',
    items: [
      {
        href: '/inventory',
        label: '재고현황',
        icon: '📊',
        resource: 'inventory_view',
        action: 'read',
      },
      {
        href: '/inventory/movements',
        label: '재고수불부',
        icon: '🔍',
        resource: 'inventory_view',
        action: 'read',
      },
    ],
  }

  // 입고 드롭다운 메뉴
  const purchasesMenu: DropdownMenu = {
    label: '입고',
    icon: '📥',
    items: [
      {
        href: '/purchases?tab=input',
        label: '입고 입력',
        icon: '📝',
        resource: 'purchases_management',
        action: 'read',
      },
      {
        href: '/purchases?tab=history',
        label: '입고 조회',
        icon: '📋',
        resource: 'purchases_management',
        action: 'read',
      },
    ],
  }

  // 판매 드롭다운 메뉴
  const salesMenu: DropdownMenu = {
    label: '판매',
    icon: '💰',
    items: [
      {
        href: '/sales?tab=input',
        label: '판매 입력',
        icon: '📝',
        resource: 'sales_management',
        action: 'read',
      },
      {
        href: '/sales?tab=history',
        label: '판매 조회',
        icon: '📋',
        resource: 'sales_management',
        action: 'read',
      },
    ],
  }
  
  // B2B 발주 드롭다운 메뉴
  const b2bMenu: DropdownMenu = {
    label: 'B2B 발주',
    icon: '🛒',
    items: [
      {
        href: '/b2b-orders/new',
        label: '발주하기',
        icon: '📝',
        resource: 'b2b_orders',
        action: 'create',
      },
      {
        href: '/b2b-orders',
        label: '발주내역',
        icon: '📋',
        resource: 'b2b_orders',
        action: 'read',
      },
      {
        href: '/b2b-orders/admin',
        label: '주문관리',
        icon: '⚙️',
        resource: 'b2b_order_processing',
        action: 'read',
      },
      {
        href: '/reports/b2b',
        label: 'B2B 정산',
        icon: '📈',
        resource: 'b2b_settlements',
        action: 'read',
      },
    ],
  }

  // 레포트 드롭다운 메뉴
  const reportsMenu: DropdownMenu = {
    label: '레포트',
    icon: '📈',
    items: [
      {
        href: '/reports/profit',
        label: '종합',
        icon: '📊',
        resource: 'reports_view',
        action: 'read',
      },
      {
        href: '/reports/purchases',
        label: '구매',
        icon: '📥',
        resource: 'reports_view',
        action: 'read',
      },
      {
        href: '/reports/sales',
        label: '판매',
        icon: '💰',
        resource: 'reports_view',
        action: 'read',
      },
    ],
  }

  // 고객만족도 독립 메뉴
  const surveyMenuItem: MenuItem = {
    href: '/reports/surveys',
    label: '고객만족도',
    icon: '⭐',
    resource: 'reports_view',
    action: 'read',
  }

  // 관리 드롭다운 메뉴
  const adminMenu: DropdownMenu = {
    label: '관리',
    icon: '⚙️',
    items: [
      {
        href: '/admin/branches',
        label: '지점',
        icon: '🏬',
        resource: 'branches_management',
        action: 'read',
      },
      {
        href: '/admin/users',
        label: '사용자',
        icon: '👥',
        resource: 'users_management',
        action: 'read',
      },
      {
        href: '/admin/categories',
        label: '카테고리',
        icon: '🏷️',
        resource: 'admin_settings',
        action: 'read',
      },
      {
        href: '/clients',
        label: '거래처',
        icon: '🏢',
        resource: 'clients_management',
        action: 'read',
      },
      {
        href: '/inventory-adjustments',
        label: '재고조정',
        icon: '🔍',
        resource: 'inventory_adjustments',
        action: 'read',
      },
      {
        href: '/admin/audit-logs',
        label: '감사로그',
        icon: '📜',
        resource: 'audit_logs_view',
        action: 'read',
      },
      {
        href: '/admin/import',
        label: '데이터 가져오기',
        icon: '📤',
        resource: 'purchases_management',
        action: 'create',
      },
    ],
  }
  
  // 권한 필터링 함수
  const filterByPermission = (items: MenuItem[]) => {
    return items.filter(item => {
      if (!item.resource || !item.action) return true
      return can(item.resource as any, item.action as any)
    })
  }
  
  const visibleMainItems = filterByPermission(mainMenuItems)
  const visibleInventoryItems = filterByPermission(inventoryMenu.items)
  const visiblePurchasesItems = filterByPermission(purchasesMenu.items)
  const visibleSalesItems = filterByPermission(salesMenu.items)
  // B2B 발주 기능 임시 숨김 (아직 미사용)
  const B2B_ENABLED = false
  const visibleB2bItems = B2B_ENABLED ? filterByPermission(b2bMenu.items) : []
  const visibleReportsItems = filterByPermission(reportsMenu.items)
  const visibleAdminItems = filterByPermission(adminMenu.items)
  const showSurvey = ['0000', '0001', '0002'].includes(user.role)
  
  // 드롭다운 내 활성 경로 체크
  const isDropdownActive = (items: MenuItem[]) => {
    return items.some(item => {
      const hrefPath = item.href.split('?')[0]
      return pathname === hrefPath || pathname.startsWith(hrefPath + '/')
    })
  }
  
  const toggleDropdown = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu)
  }
  
  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center hover:opacity-80 transition">
            <Image src="/logo.png" alt="DR.Evers ERP" width={180} height={50} priority />
          </Link>
          
          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center space-x-1" ref={dropdownRef}>
            {/* 일반 메뉴 */}
            {visibleMainItems.map((item) => {
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition
                    ${isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className={isActive ? 'text-lg' : ''}>{item.icon}</span>
                  <span className="ml-1 hidden lg:inline">{item.label}</span>
                </Link>
              )
            })}
            
            {/* 재고 드롭다운 */}
            {visibleInventoryItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('inventory')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('inventory')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(inventoryMenu.items)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{inventoryMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{inventoryMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'inventory' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'inventory' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visibleInventoryItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 입고 드롭다운 */}
            {visiblePurchasesItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('purchases')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('purchases')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(purchasesMenu.items)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{purchasesMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{purchasesMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'purchases' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'purchases' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visiblePurchasesItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href.split('?')[0] && item.href.includes(`tab=${new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') || 'input'}`)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 판매 드롭다운 */}
            {visibleSalesItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('sales')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('sales')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(salesMenu.items)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{salesMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{salesMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'sales' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'sales' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visibleSalesItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href.split('?')[0] && item.href.includes(`tab=${new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') || 'input'}`)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* B2B 발주 드롭다운 */}
            {visibleB2bItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('b2b')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('b2b')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(b2bMenu.items)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{b2bMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{b2bMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'b2b' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'b2b' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visibleB2bItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 레포트 드롭다운 */}
            {visibleReportsItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('reports')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('reports')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(reportsMenu.items)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{reportsMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{reportsMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'reports' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {openDropdown === 'reports' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visibleReportsItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* 관리 드롭다운 */}
            {visibleAdminItems.length > 0 && (
              <div className="relative" onMouseEnter={() => handleMouseEnter('admin')} onMouseLeave={handleMouseLeave}>
                <button
                  onClick={() => toggleDropdown('admin')}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition flex items-center
                    ${isDropdownActive(adminMenu.items)
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{adminMenu.icon}</span>
                  <span className="ml-1 hidden lg:inline">{adminMenu.label}</span>
                  <svg className={`ml-1 h-4 w-4 transition-transform ${openDropdown === 'admin' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {openDropdown === 'admin' && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {visibleAdminItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenDropdown(null)}
                        className={`
                          block px-4 py-2 text-sm transition
                          ${pathname === item.href
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-900 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 고객만족도 독립 버튼 */}
            {showSurvey && (
              <Link
                href={surveyMenuItem.href}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition border
                  ${pathname === surveyMenuItem.href
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                  }
                `}
              >
                <span>{surveyMenuItem.icon}</span>
                <span className="ml-1 hidden lg:inline">{surveyMenuItem.label}</span>
              </Link>
            )}
          </div>

          {/* 데스크탑 사용자 정보 */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.display_name}
              </p>
              <p className="text-xs text-gray-900">
                {ROLE_LABELS[user.role]} • {user.branch_name || '전체'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              로그아웃
            </button>
          </div>

          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="메뉴 열기/닫기"
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

        {/* 모바일 메뉴 */}
        <div 
          className={`md:hidden border-t border-gray-200 overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-screen opacity-100 py-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1">
            {/* 일반 메뉴 */}
            {visibleMainItems.map((item) => {
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    block px-3 py-2 rounded-lg text-base font-medium transition-all
                    ${isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
            
            {/* 재고 섹션 */}
            {visibleInventoryItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {inventoryMenu.icon} {inventoryMenu.label}
                </div>
                {visibleInventoryItems.map((item) => {
                  const isActive = pathname === item.href

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}

            {/* 입고 섹션 */}
            {visiblePurchasesItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {purchasesMenu.icon} {purchasesMenu.label}
                </div>
                {visiblePurchasesItems.map((item) => {
                  const hrefPath = item.href.split('?')[0]
                  const isActive = pathname === hrefPath

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}

            {/* 판매 섹션 */}
            {visibleSalesItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {salesMenu.icon} {salesMenu.label}
                </div>
                {visibleSalesItems.map((item) => {
                  const hrefPath = item.href.split('?')[0]
                  const isActive = pathname === hrefPath

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}

            {/* B2B 발주 섹션 */}
            {visibleB2bItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {b2bMenu.icon} {b2bMenu.label}
                </div>
                {visibleB2bItems.map((item) => {
                  const isActive = pathname === item.href

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}

            {/* 레포트 섹션 */}
            {visibleReportsItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {reportsMenu.icon} {reportsMenu.label}
                </div>
                {visibleReportsItems.map((item) => {
                  const isActive = pathname === item.href

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}
            
            {/* 관리 섹션 */}
            {visibleAdminItems.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-900 uppercase tracking-wider mt-4">
                  {adminMenu.icon} {adminMenu.label}
                </div>
                {visibleAdminItems.map((item) => {
                  const isActive = pathname === item.href
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-3 py-2 pl-6 rounded-lg text-base font-medium transition-all
                        ${isActive 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-900 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </>
            )}

            {/* 고객만족도 */}
            {showSurvey && (
              <Link
                href={surveyMenuItem.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  block px-3 py-2 rounded-lg text-base font-medium transition-all mt-4 border
                  ${pathname === surveyMenuItem.href
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                  }
                `}
              >
                <span className="mr-2">{surveyMenuItem.icon}</span>
                {surveyMenuItem.label}
              </Link>
            )}
          </div>

          {/* 모바일 사용자 정보 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="px-3 mb-3">
              <p className="text-sm font-medium text-gray-900">
                {user.display_name}
              </p>
              <p className="text-xs text-gray-900">
                {ROLE_LABELS[user.role]} • {user.branch_name || '전체'}
              </p>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                onLogout()
              }}
              className="w-full text-left px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}