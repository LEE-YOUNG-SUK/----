import React from 'react'

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'success' | 'warning' | 'error' | 'info'
  children: React.ReactNode
  className?: string
}

/**
 * 상태 표시 배지
 */
export function StatusBadge({ status, children, className = '' }: StatusBadgeProps) {
  const colorClasses = {
    active: 'bg-green-100 text-green-800 border-green-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
      ${colorClasses[status]}
      ${className}
    `}>
      {children}
    </span>
  )
}
