import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

/**
 * 페이지 상단 헤더 컴포넌트
 * - 제목 + 설명 + 액션 버튼 영역
 * - 반응형: 모바일(세로), 데스크탑(가로)
 */
export function PageHeader({ 
  title, 
  description, 
  actions, 
  className = '' 
}: PageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-900">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
