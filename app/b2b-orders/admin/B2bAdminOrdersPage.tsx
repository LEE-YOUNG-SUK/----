'use client'

import { useState, useEffect, useCallback } from 'react'
import { ContentCard } from '@/components/ui/Card'
import { B2bOrderList } from '@/components/b2b-orders/B2bOrderList'
import { B2bOrderFiltersComponent } from '@/components/b2b-orders/B2bOrderFilters'
import { getAllOrders, getBranchesList } from './actions'
import { toast } from 'sonner'
import type { UserData } from '@/types'
import type { B2bOrder, B2bOrderFilters } from '@/types/b2b'

interface Props {
  session: UserData
}

export function B2bAdminOrdersPage({ session }: Props) {
  const [orders, setOrders] = useState<B2bOrder[]>([])
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<B2bOrderFilters>({
    status: null,
    branch_id: null,
    from_date: null,
    to_date: null,
  })

  // 지점 목록 로드
  useEffect(() => {
    async function loadBranches() {
      const result = await getBranchesList()
      if (result.success) {
        setBranches(result.data)
      }
    }
    loadBranches()
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const result = await getAllOrders(filters)
    if (result.success) {
      setOrders(result.data)
    } else {
      toast.error(result.message)
    }
    setLoading(false)
  }, [filters])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">B2B 주문 관리</h1>
      </div>

      <ContentCard>
        <div className="mb-4">
          <B2bOrderFiltersComponent
            filters={filters}
            onFilterChange={setFilters}
            branches={branches}
            showBranchFilter
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">로딩 중...</div>
        ) : (
          <B2bOrderList orders={orders} basePath="/b2b-orders/admin" showBranch />
        )}
      </ContentCard>
    </div>
  )
}
