'use client'

interface Props {
  value: number
  label?: string
  className?: string
}

export function B2bProgressBar({ value, label, className = '' }: Props) {
  const percent = Math.min(100, Math.max(0, value))
  const colorClass =
    percent >= 100
      ? 'bg-green-500'
      : percent >= 50
        ? 'bg-blue-500'
        : percent > 0
          ? 'bg-yellow-500'
          : 'bg-gray-300'

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
