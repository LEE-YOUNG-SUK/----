import React from 'react'

interface DangerButtonProps {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  children: React.ReactNode
  className?: string
}

/**
 * 위험한 액션 버튼 (빨간색)
 * - 삭제, 취소 등 위험한 액션에 사용
 */
export function DangerButton({ 
  onClick, 
  disabled, 
  loading,
  type = 'button',
  children,
  className = ''
}: DangerButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        px-4 py-2 bg-red-600 text-white rounded-lg 
        hover:bg-red-700 active:bg-red-800
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors font-medium shadow-sm
        ${className}
      `}
    >
      {loading ? '처리 중...' : children}
    </button>
  )
}
