import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon?: React.ReactNode
  variant?: 'default' | 'primary' | 'success'
}

/**
 * 통계 카드 컴포넌트
 */
export function StatCard({ label, value, unit, icon, variant = 'default' }: StatCardProps) {
  const colorClass = {
    default: 'text-gray-900',
    primary: 'text-blue-600',
    success: 'text-green-600',
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs sm:text-sm text-gray-600">{label}</p>
        {icon && <span className="text-lg sm:text-xl">{icon}</span>}
      </div>
      <p className={`text-base sm:text-lg font-bold ${colorClass[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-xs sm:text-sm ml-1">{unit}</span>}
      </p>
    </div>
  )
}
