import { InventorySummary } from '@/types/inventory'

interface Props {
  summary: InventorySummary | null
}

export function InventoryStats({ summary }: Props) {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    )
  }
  
  const stats = [
    {
      label: '총 품목 수',
      value: `${summary.total_products.toLocaleString()}개`,
      icon: '📦',
      color: 'blue'
    },
    {
      label: '총 재고 수량',
      value: summary.total_quantity.toLocaleString(),
      icon: '📊',
      color: 'green'
    },
    {
      label: '총 재고 금액',
      value: `₩${summary.total_value.toLocaleString()}`,
      icon: '💰',
      color: 'purple'
    },
    {
      label: '부족 품목',
      value: `${summary.low_stock_count.toLocaleString()}개`,
      icon: '⚠️',
      color: 'yellow'
    },
    {
      label: '재고 없음',
      value: `${summary.out_of_stock_count.toLocaleString()}개`,
      icon: '🚨',
      color: 'red'
    }
  ]
  
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900'
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`rounded-lg shadow border p-6 ${colorClasses[stat.color as keyof typeof colorClasses]}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium opacity-80">{stat.label}</span>
            <span className="text-2xl">{stat.icon}</span>
          </div>
          <div className="text-2xl font-bold">{stat.value}</div>
        </div>
      ))}
    </div>
  )
}