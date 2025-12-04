import React from 'react'

interface SecondaryButtonProps {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children: React.ReactNode
  className?: string
}

/**
 * 보조 액션 버튼 (회색)
 * - 취소, 닫기 등 보조 액션에 사용
 */
export function SecondaryButton({ 
  onClick, 
  disabled,
  type = 'button',
  children,
  className = ''
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 bg-gray-200 text-gray-800 rounded-lg 
        hover:bg-gray-300 active:bg-gray-400
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors font-medium
        ${className}
      `}
    >
      {children}
    </button>
  )
}
