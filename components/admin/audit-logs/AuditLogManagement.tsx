'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { AuditLogFilters } from './AuditLogFilters'
import { AuditLogTable } from './AuditLogTable'
import { AuditStatsCard } from './AuditStatsCard'
import { getAuditLogs, getAuditStats } from '@/app/admin/audit-logs/actions'
import type { AuditLogListItem, AuditStats, AuditLogFilter } from '@/types/audit'

interface Props {
  userSession: {
    user_id: string
    username: string
    role: string
    branch_id: string | null
    branch_name: string | null
  }
}

export function AuditLogManagement({ userSession }: Props) {
  const [logs, setLogs] = useState<AuditLogListItem[]>([])
  const [stats, setStats] = useState<AuditStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<AuditLogFilter>({})

  // 초기 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async (filterData?: AuditLogFilter) => {
    setLoading(true)
    try {
      // 로그 조회
      const logsResult = await getAuditLogs(
        userSession.user_id,
        userSession.role,
        userSession.branch_id,
        filterData || filters
      )

      if (logsResult.success) {
        setLogs(logsResult.data)
      }

      // 통계 조회
      const statsResult = await getAuditStats(
        userSession.user_id,
        userSession.role,
        userSession.branch_id,
        filterData?.start_date,
        filterData?.end_date
      )

      if (statsResult.success) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Load audit logs error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (filterData: AuditLogFilter) => {
    setFilters(filterData)
    loadData(filterData)
  }

  const handleReset = () => {
    setFilters({})
    loadData({})
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <AuditStatsCard stats={stats} loading={loading} />

      {/* 필터 */}
      <Card>
        <div className="p-6">
          <AuditLogFilters
            userSession={userSession}
            onFilter={handleFilter}
            onReset={handleReset}
            loading={loading}
          />
        </div>
      </Card>

      {/* 테이블 */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              변경 이력 ({logs.length}건)
            </h3>
          </div>
          <AuditLogTable
            logs={logs}
            loading={loading}
            userSession={userSession}
          />
        </div>
      </Card>
    </div>
  )
}
