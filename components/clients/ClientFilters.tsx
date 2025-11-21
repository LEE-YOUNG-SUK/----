'use client'

import { useState, useMemo } from 'react'
import type { Client } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { Button } from '../ui/Button'

interface ClientFiltersProps {
  clients: Client[]
  onFilterChange: (filtered: Client[]) => void
}

export default function ClientFilters({ clients, onFilterChange }: ClientFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
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

    // 유형 필터
    if (typeFilter !== 'all') {
      result = result.filter(client => client.type === typeFilter)
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(client => 
        statusFilter === 'active' ? client.is_active : !client.is_active
      )
    }

    return result
  }, [clients, searchTerm, typeFilter, statusFilter])

  // 필터 변경 시 부모에게 전달
  useMemo(() => {
    onFilterChange(filtered)
  }, [filtered, onFilterChange])

  const handleReset = () => {
    setSearchTerm('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  return (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="전체 유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          <SelectItem value="supplier">공급업체</SelectItem>
          <SelectItem value="customer">고객</SelectItem>
          <SelectItem value="both">공급업체 + 고객</SelectItem>
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="전체 상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="active">활성</SelectItem>
          <SelectItem value="inactive">비활성</SelectItem>
        </SelectContent>
      </Select>

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
