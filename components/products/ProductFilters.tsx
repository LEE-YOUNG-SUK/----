'use client'

import { useState, useMemo } from 'react'
import type { Product } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { Button } from '../ui/Button'

interface ProductFiltersProps {
  products: Product[]
  onFilterChange: (filtered: Product[]) => void
}

export default function ProductFilters({ products, onFilterChange }: ProductFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 필터링된 결과
  const filtered = useMemo(() => {
    let result = [...products]

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        product =>
          product.code.toLowerCase().includes(term) ||
          product.name.toLowerCase().includes(term) ||
          product.manufacturer?.toLowerCase().includes(term)
      )
    }

    // 카테고리 필터
    if (categoryFilter !== 'all') {
      result = result.filter(product => product.category === categoryFilter)
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(product => 
        statusFilter === 'active' ? product.is_active : !product.is_active
      )
    }

    return result
  }, [products, searchTerm, categoryFilter, statusFilter])

  // 필터 변경 시 부모에게 전달
  useMemo(() => {
    onFilterChange(filtered)
  }, [filtered, onFilterChange])

  const handleReset = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setStatusFilter('all')
  }

  // 유니크한 카테고리 목록
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))

  return (
    <>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="전체 카테고리" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 카테고리</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
          ))}
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
        placeholder="🔍 검색 (코드, 품명, 제조사)"
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
