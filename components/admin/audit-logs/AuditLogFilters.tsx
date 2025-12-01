'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { AuditLogFilter } from '@/types/audit'

interface Props {
  userSession: {
    user_id: string
    role: string
    branch_id: string | null
  }
  onFilter: (filters: AuditLogFilter) => void
  onReset: () => void
  loading: boolean
}

export function AuditLogFilters({ userSession, onFilter, onReset, loading }: Props) {
  const [tableName, setTableName] = useState<string>('')
  const [action, setAction] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const filters: AuditLogFilter = {}
    if (tableName) filters.table_name = tableName as any
    if (action) filters.action = action as any
    if (startDate) filters.start_date = startDate
    if (endDate) filters.end_date = endDate

    onFilter(filters)
  }

  const handleReset = () => {
    setTableName('')
    setAction('')
    setStartDate('')
    setEndDate('')
    onReset()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 테이블명 */}
        <div>
          <Label htmlFor="table_name">테이블</Label>
          <select
            id="table_name"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            disabled={loading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">전체</option>
            <option value="purchases">입고(purchases)</option>
            <option value="sales">판매(sales)</option>
          </select>
        </div>

        {/* 액션 */}
        <div>
          <Label htmlFor="action">액션</Label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={loading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">전체</option>
            <option value="UPDATE">수정(UPDATE)</option>
            <option value="DELETE">삭제(DELETE)</option>
          </select>
        </div>

        {/* 시작일 */}
        <div>
          <Label htmlFor="start_date">시작일</Label>
          <Input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* 종료일 */}
        <div>
          <Label htmlFor="end_date">종료일</Label>
          <Input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          🔍 조회
        </Button>
        <Button
          type="button"
          onClick={handleReset}
          disabled={loading}
          variant="outline"
        >
          🔄 초기화
        </Button>
      </div>
    </form>
  )
}
