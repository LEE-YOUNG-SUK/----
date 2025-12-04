import React from 'react'

interface PrimaryButtonProps {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  children: React.ReactNode
  className?: string
  fullWidth?: boolean
}

/**
 * 주요 액션 버튼 (파란색)
 * - 저장, 조회, 확인 등 primary 액션에 사용
 */
export function PrimaryButton({ 
  onClick, 
  disabled, 
  loading,
  type = 'button',
  children,
  className = '',
  fullWidth = false
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        px-4 py-2 bg-blue-600 text-white rounded-lg 
        hover:bg-blue-700 active:bg-blue-800
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors font-medium shadow-sm
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          처리 중...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
