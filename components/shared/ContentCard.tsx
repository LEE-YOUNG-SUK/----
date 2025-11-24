import { ReactNode } from 'react'

interface ContentCardProps {
  children: ReactNode
  title?: string
  headerActions?: ReactNode
  className?: string
}

/**
 * 섹션/카드 wrapper 컴포넌트
 * - 흰 배경, 그림자, 둥근 모서리
 * - 선택적 제목과 헤더 액션 버튼 영역
 */
export function ContentCard({ 
  children, 
  title, 
  headerActions, 
  className = '' 
}: ContentCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {(title || headerActions) && (
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
