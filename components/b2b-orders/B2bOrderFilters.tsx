'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  B2B_ORDER_STATUS_LABELS,
  type B2bOrderStatus,
  type B2bOrderFilters,
} from '@/types/b2b'

interface Props {
  filters: B2bOrderFilters
  onFilterChange: (filters: B2bOrderFilters) => void
  branches?: { id: string; code: string; name: string }[]
  showBranchFilter?: boolean
}

export function B2bOrderFiltersComponent({ filters, onFilterChange, branches, showBranchFilter }: Props) {
  const handleReset = () => {
    onFilterChange({
      status: null,
      branch_id: null,
      from_date: null,
      to_date: null,
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* 상태 필터 */}
      <div className="w-40">
        <Select
          selectSize="sm"
          label="상태"
          value={filters.status || ''}
          onValueChange={(v) => onFilterChange({ ...filters, status: (v || null) as B2bOrderStatus | null })}
        >
          <option value="">전체</option>
          {Object.entries(B2B_ORDER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
      </div>

      {/* 지점 필터 (본사용) */}
      {showBranchFilter && branches && (
        <div className="w-40">
          <Select
            selectSize="sm"
            label="지점"
            value={filters.branch_id || ''}
            onValueChange={(v) => onFilterChange({ ...filters, branch_id: v || null })}
          >
            <option value="">전체 지점</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
      )}

      {/* 기간 필터 */}
      <div className="w-40">
        <Input
          inputSize="sm"
          label="시작일"
          type="date"
          value={filters.from_date || ''}
          onChange={(e) => onFilterChange({ ...filters, from_date: e.target.value || null })}
        />
      </div>
      <div className="w-40">
        <Input
          inputSize="sm"
          label="종료일"
          type="date"
          value={filters.to_date || ''}
          onChange={(e) => onFilterChange({ ...filters, to_date: e.target.value || null })}
        />
      </div>

      <Button variant="outline" size="sm" onClick={handleReset}>
        초기화
      </Button>
    </div>
  )
}
