'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { B2bOrderDetailView } from '@/components/b2b-orders/B2bOrderDetail'
import { B2bShipmentList } from '@/components/b2b-orders/B2bShipmentList'
import { B2bStatementList } from '@/components/b2b-orders/B2bStatementList'
import { B2bSettlementList } from '@/components/b2b-orders/B2bSettlementList'
import { B2bSettlementSummaryCard } from '@/components/b2b-orders/B2bSettlementSummary'
import { B2bTaxInvoiceList } from '@/components/b2b-orders/B2bTaxInvoiceList'
import { getOrderDetail, submitOrder, cancelDraftOrder, getShipmentsForOrder, confirmReceipt, getStatementsForOrder, getSettlementsForOrder, getSettlementSummary, getTaxInvoicesForOrder } from '../actions'
import { toast } from 'sonner'
import type { UserData } from '@/types'
import type { B2bOrderDetail, B2bShipment, B2bTransactionStatement, B2bSettlement, B2bSettlementSummary, B2bTaxInvoice } from '@/types/b2b'

interface Props {
  session: UserData
  orderId: string
}

export function B2bOrderDetailPage({ session, orderId }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<B2bOrderDetail | null>(null)
  const [shipments, setShipments] = useState<B2bShipment[]>([])
  const [statements, setStatements] = useState<B2bTransactionStatement[]>([])
  const [settlements, setSettlements] = useState<B2bSettlement[]>([])
  const [settlementSummary, setSettlementSummary] = useState<B2bSettlementSummary | null>(null)
  const [taxInvoices, setTaxInvoices] = useState<B2bTaxInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [orderResult, shipmentsResult, statementsResult, settlementsResult, summaryResult, invoicesResult] = await Promise.all([
      getOrderDetail(orderId),
      getShipmentsForOrder(orderId),
      getStatementsForOrder(orderId),
      getSettlementsForOrder(orderId),
      getSettlementSummary(orderId),
      getTaxInvoicesForOrder(orderId)
    ])

    if (orderResult.success && orderResult.data) {
      setDetail(orderResult.data)
    } else {
      toast.error(orderResult.message || '주문을 찾을 수 없습니다.')
      router.push('/b2b-orders')
      return
    }

    if (shipmentsResult.success) {
      setShipments(shipmentsResult.data)
    }

    if (statementsResult.success) {
      setStatements(statementsResult.data)
    }

    if (settlementsResult.success) {
      setSettlements(settlementsResult.data)
    }

    if (summaryResult.success && summaryResult.data) {
      setSettlementSummary(summaryResult.data)
    }

    if (invoicesResult.success) {
      setTaxInvoices(invoicesResult.data)
    }

    setLoading(false)
  }, [orderId, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async () => {
    if (!detail) return
    setActionLoading(true)
    const result = await submitOrder(detail.order.id)
    if (result.success) {
      toast.success(result.message)
      loadData()
    } else {
      toast.error(result.message)
    }
    setActionLoading(false)
  }

  const handleCancelDraft = async () => {
    if (!detail) return
    setActionLoading(true)
    const result = await cancelDraftOrder(detail.order.id)
    if (result.success) {
      toast.success(result.message)
      router.push('/b2b-orders')
    } else {
      toast.error(result.message)
    }
    setActionLoading(false)
  }

  const handleConfirmReceipt = async (shipmentId: string) => {
    setConfirmingId(shipmentId)
    try {
      const result = await confirmReceipt(shipmentId)
      if (result.success) {
        toast.success(result.message)
        loadData()
      } else {
        toast.error(result.message)
      }
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (!detail) return null

  // 출고 내역이 있는 상태인지 확인
  const hasShipments = shipments.length > 0

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/b2b-orders')}>
            &larr; 목록
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
        </div>

        {/* draft 상태일 때 액션 버튼 */}
        {detail.order.status === 'draft' && (
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelDraft}
              loading={actionLoading}
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={actionLoading}
            >
              주문 제출
            </Button>
          </div>
        )}
      </div>

      {/* 주문 상세 */}
      <B2bOrderDetailView detail={detail} />

      {/* 출고 내역 + 수령확인 */}
      {hasShipments && (
        <B2bShipmentList
          shipments={shipments}
          onConfirmReceipt={handleConfirmReceipt}
          confirmLoading={confirmingId}
        />
      )}

      {/* 거래명세서 (발행된 것만 표시) */}
      {statements.length > 0 && (
        <B2bStatementList statements={statements} />
      )}

      {/* 정산 현황 (원장만) */}
      {session.role === '0001' && settlementSummary && settlementSummary.total_price > 0 && (
        <B2bSettlementSummaryCard summary={settlementSummary} />
      )}

      {/* 정산 내역 (원장만) */}
      {session.role === '0001' && settlements.length > 0 && (
        <B2bSettlementList settlements={settlements} />
      )}

      {/* 세금계산서 (원장만, 발행된 것만) */}
      {session.role === '0001' && taxInvoices.length > 0 && (
        <B2bTaxInvoiceList invoices={taxInvoices} />
      )}
    </div>
  )
}
