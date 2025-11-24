import { ReactNode } from 'react'

interface PageLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * 전체 페이지 레이아웃 wrapper
 * - 일관된 배경색, 최대 너비, padding 제공
 * - 반응형 컨테이너 (모바일: px-4, 태블릿: px-6, 데스크탑: px-8)
 */
export function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
