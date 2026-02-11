'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Client } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface ClientFiltersProps {
  clients: Client[]
  onFilterChange: (filtered: Client[]) => void
}

export default function ClientFilters({ clients, onFilterChange }: ClientFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 필터링된 결과
  const filtered = useMemo(() => {
    let result = [...clients]

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        client =>
          client.code.toLowerCase().includes(term) ||
          client.name.toLowerCase().includes(term) ||
          client.contact_person?.toLowerCase().includes(term)
      )
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(client => 
        statusFilter === 'active' ? client.is_active : !client.is_active
      )
    }

    return result
  }, [clients, searchTerm, statusFilter])

  // 필터 변경 시 부모에게 전달
  useEffect(() => {
    onFilterChange(filtered)
  }, [filtered, onFilterChange])

  const handleReset = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  return (
    <>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-[180px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">전체 상태</option>
        <option value="active">활성</option>
        <option value="inactive">비활성</option>
      </select>

      <Input
        placeholder="🔍 검색 (코드, 상호명, 대표자)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1 min-w-[200px]"
      />

      <Button variant="outline" onClick={handleReset} className="whitespace-nowrap">
        🔄 초기화
      </Button>
      
      <span className="text-sm text-muted-foreground whitespace-nowrap self-center">
        {filtered.length}개
      </span>
    </>
  )
}
