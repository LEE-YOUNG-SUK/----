'use client'

/**
 * 재고 조정 통계 컴포넌트 (Phase 5: Inventory Adjustment)
 * - 기간별 조정 통계
 * - 증가/감소 건수 및 금액
 * - 사유별 분류
 */

import { useEffect, useState } from 'react'
import { getAdjustmentSummary } from '@/app/inventory-adjustments/actions'
import type { AdjustmentSummary, AdjustmentReason } from '@/types/inventory-adjustment'

interface AdjustmentStatsProps {
  userId: string
  userRole: string
  userBranchId: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export default function AdjustmentStats({ 
  userId, 
  userRole, 
  userBranchId,
  startDate,
  endDate
}: AdjustmentStatsProps) {
  const [summary, setSummary] = useState<AdjustmentSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true)
      const data = await getAdjustmentSummary(userId, userRole, userBranchId, startDate, endDate)
      setSummary(data)
      setIsLoading(false)
    }

    fetchSummary()
  }, [userId, userRole, userBranchId, startDate, endDate])

  const reasonLabels: Record<AdjustmentReason, string> = {
    STOCK_COUNT: '실사',
    DAMAGE: '불량',
    LOSS: '분실',
    RETURN: '반품',
    OTHER: '기타'
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-600">
        통계 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const stats = [
    {
      label: '전체 조정',
      value: `${summary.total_adjustments.toLocaleString()}건`,
      icon: '📝',
      color: 'blue',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-200',
      textClass: 'text-blue-900',
      iconClass: 'text-blue-600'
    },
    {
      label: '재고 증가',
      value: `${summary.increase_count.toLocaleString()}건`,
      subValue: `₩${summary.total_increase_value.toLocaleString()}`,
      icon: '⬆️',
      color: 'green',
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
      textClass: 'text-green-900',
      iconClass: 'text-green-600'
    },
    {
      label: '재고 감소',
      value: `${summary.decrease_count.toLocaleString()}건`,
      subValue: `₩${summary.total_decrease_value.toLocaleString()}`,
      icon: '⬇️',
      color: 'red',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      textClass: 'text-red-900',
      iconClass: 'text-red-600'
    },
    {
      label: '순 변동',
      value: `₩${(summary.total_increase_value - summary.total_decrease_value).toLocaleString()}`,
      icon: summary.total_increase_value > summary.total_decrease_value ? '📈' : '📉',
      color: summary.total_increase_value > summary.total_decrease_value ? 'green' : 'red',
      bgClass: summary.total_increase_value > summary.total_decrease_value ? 'bg-green-50' : 'bg-red-50',
      borderClass: summary.total_increase_value > summary.total_decrease_value ? 'border-green-200' : 'border-red-200',
      textClass: summary.total_increase_value > summary.total_decrease_value ? 'text-green-900' : 'text-red-900',
      iconClass: summary.total_increase_value > summary.total_decrease_value ? 'text-green-600' : 'text-red-600'
    }
  ]

  // 사유별 데이터 추출
  const reasonStats = summary.by_reason 
    ? Object.entries(summary.by_reason).map(([reason, data]: [string, any]) => ({
        reason: reasonLabels[reason as AdjustmentReason] || reason,
        count: data.count || 0,
        totalCost: data.total_cost || 0
      }))
    : []

  return (
    <div className="space-y-6">
      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`rounded-lg shadow border ${stat.borderClass} ${stat.bgClass} p-6 transition-all hover:shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium ${stat.textClass} opacity-80`}>
                {stat.label}
              </span>
              <span className={`text-2xl ${stat.iconClass}`}>{stat.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.textClass}`}>
              {stat.value}
            </div>
            {stat.subValue && (
              <div className={`text-sm ${stat.textClass} opacity-75 mt-1`}>
                {stat.subValue}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 사유별 통계 */}
      {reasonStats.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 사유별 통계</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {reasonStats.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="text-sm text-gray-600 mb-1">{item.reason}</div>
                <div className="text-xl font-bold text-gray-900">{item.count}건</div>
                <div className="text-sm text-gray-600 mt-1">
                  ₩{item.totalCost.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기간 표시 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <span className="text-sm text-blue-800">
          📅 통계 기간: <span className="font-semibold">{startDate}</span> ~ <span className="font-semibold">{endDate}</span>
        </span>
      </div>
    </div>
  )
}
