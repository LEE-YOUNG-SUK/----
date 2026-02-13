'use client'

import type { AuditStats } from '@/types/audit'
import { Card } from '@/components/ui/Card'

interface Props {
  stats: AuditStats[]
  loading: boolean
}

export function AuditStatsCard({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <div className="p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // 통계 집계
  const totalLogs = stats.reduce((sum, s) => sum + s.count, 0)
  const totalInserts = stats
    .filter(s => s.action === 'INSERT')
    .reduce((sum, s) => sum + s.count, 0)
  const totalUpdates = stats
    .filter(s => s.action === 'UPDATE')
    .reduce((sum, s) => sum + s.count, 0)
  const totalDeletes = stats
    .filter(s => s.action === 'DELETE')
    .reduce((sum, s) => sum + s.count, 0)
  const uniqueUsers = Math.max(...stats.map(s => s.unique_users), 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* 전체 로그 */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">전체 로그</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totalLogs.toLocaleString()}
              </p>
            </div>
            <div className="text-3xl">📜</div>
          </div>
        </div>
      </Card>

      {/* 등록 */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">데이터 등록</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {totalInserts.toLocaleString()}
              </p>
            </div>
            <div className="text-3xl">➕</div>
          </div>
        </div>
      </Card>

      {/* 수정 */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">데이터 수정</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {totalUpdates.toLocaleString()}
              </p>
            </div>
            <div className="text-3xl">✏️</div>
          </div>
        </div>
      </Card>

      {/* 삭제 */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">데이터 삭제</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {totalDeletes.toLocaleString()}
              </p>
            </div>
            <div className="text-3xl">🗑️</div>
          </div>
        </div>
      </Card>

      {/* 활동 사용자 */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">활동 사용자</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">
                {uniqueUsers}
              </p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
