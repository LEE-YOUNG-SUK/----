import React from 'react'

interface FormGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5 | 6
  className?: string
}

/**
 * 폼 입력 레이아웃 통일 컴포넌트
 * 모바일: 1열, 태블릿: 2열, 데스크톱: columns 설정값
 */
export function FormGrid({ children, columns = 4, className = '' }: FormGridProps) {
  const colsClass = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
  }

  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 ${colsClass[columns]} ${className}`}>
      {children}
    </div>
  )
}
