import React from 'react'

interface SaveButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label?: string
  className?: string
}

/**
 * 저장 버튼 통일 컴포넌트
 */
export function SaveButton({ 
  onClick, 
  disabled, 
  loading, 
  label = '저장',
  className = ''
}: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-sm ${className}`}
    >
      {loading ? (
        <>
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          처리 중...
        </>
      ) : (
        label
      )}
    </button>
  )
}
