'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { B2bOrderDetailView } from '@/components/b2b-orders/B2bOrderDetail'
import { B2bOrderStatusActions } from '@/components/b2b-orders/B2bOrderStatusActions'
import { B2bShipmentForm } from '@/components/b2b-orders/B2bShipmentForm'
import { B2bShipmentList } from '@/components/b2b-orders/B2bShipmentList'
import { B2bStatementCreateForm } from '@/components/b2b-orders/B2bStatementCreateForm'
import { B2bStatementList } from '@/components/b2b-orders/B2bStatementList'
import { B2bSettlementForm } from '@/components/b2b-orders/B2bSettlementForm'
import { B2bSettlementList } from '@/components/b2b-orders/B2bSettlementList'
import { B2bSettlementSummaryCard } from '@/components/b2b-orders/B2bSettlementSummary'
import { B2bTaxInvoiceList } from '@/components/b2b-orders/B2bTaxInvoiceList'
import { getAdminOrderDetail, getShipmentsForOrder, getStatementsForOrder, getSettlementsForOrder, getSettlementSummary, completeOrder } from '../actions'
import { createTaxInvoice, getTaxInvoicesForOrder } from '../tax-invoices/actions'
import { toast } from 'sonner'
import type { UserData } from '@/types'
import type { B2bOrderDetail, B2bShipment, B2bTransactionStatement, B2bSettlement, B2bSettlementSummary, B2bTaxInvoice } from '@/types/b2b'

interface Props {
  session: UserData
  orderId: string
}

export function B2bAdminOrderDetailPage({ session, orderId }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<B2bOrderDetail | null>(null)
  const [shipments, setShipments] = useState<B2bShipment[]>([])
  const [statements, setStatements] = useState<B2bTransactionStatement[]>([])
  const [settlements, setSettlements] = useState<B2bSettlement[]>([])
  const [settlementSummary, setSettlementSummary] = useState<B2bSettlementSummary | null>(null)
  const [taxInvoices, setTaxInvoices] = useState<B2bTaxInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showShipmentForm, setShowShipmentForm] = useState(false)
  const [showStatementForm, setShowStatementForm] = useState(false)
  const [showSettlementForm, setShowSettlementForm] = useState(false)
  const [completingOrder, setCompletingOrder] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  const loadData = useCallback(async () => {
    const [orderResult, shipmentsResult, statementsResult, settlementsResult, summaryResult, invoicesResult] = await Promise.all([
      getAdminOrderDetail(orderId),
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
      router.push('/b2b-orders/admin')
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

  // router.refresh 대신 수동 리로드 (클라이언트 상태 갱신)
  const handleRefresh = () => {
    setLoading(true)
    loadData()
  }

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (!detail) return null

  // 출고 가능 여부: approved 또는 partially_shipped
  const canShip = detail.order.status === 'approved' || detail.order.status === 'partially_shipped'
  // 거래명세서 생성 가능: 취소/draft 상태가 아닌 주문
  const canCreateStatement = !['draft', 'pending_approval', 'canceled'].includes(detail.order.status)
  // 정산 가능: shipped 또는 partially_settled
  const canSettle = detail.order.status === 'shipped' || detail.order.status === 'partially_settled'
  // 주문 완료 가능: settled
  const canComplete = detail.order.status === 'settled'

  // 세금계산서 생성 가능
  const canCreateInvoice = canCreateStatement

  const handleCreateTaxInvoice = async () => {
    setCreatingInvoice(true)
    try {
      const result = await createTaxInvoice(detail.order.id)
      if (result.success) {
        toast.success(result.message)
        handleRefresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setCreatingInvoice(false)
    }
  }

  const handleCompleteOrder = async () => {
    setCompletingOrder(true)
    try {
      const result = await completeOrder(detail.order.id)
      if (result.success) {
        toast.success(result.message)
        handleRefresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setCompletingOrder(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/b2b-orders/admin')}>
            &larr; 목록
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">주문 상세 (관리)</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* 출고 버튼 */}
          {canComplete && (
            <Button size="sm" variant="outline" onClick={handleCompleteOrder} disabled={completingOrder}>
              {completingOrder ? '처리 중...' : '주문 완료'}
            </Button>
          )}
          {canSettle && (
            <Button size="sm" variant="outline" onClick={() => setShowSettlementForm(true)}>
              정산 처리
            </Button>
          )}
          {canCreateInvoice && (
            <Button size="sm" variant="outline" onClick={handleCreateTaxInvoice} disabled={creatingInvoice}>
              {creatingInvoice ? '...' : '세금계산서'}
            </Button>
          )}
          {canCreateStatement && (
            <Button size="sm" variant="outline" onClick={() => setShowStatementForm(true)}>
              거래명세서 생성
            </Button>
          )}
          {canShip && (
            <Button size="sm" onClick={() => setShowShipmentForm(true)}>
              출고 처리
            </Button>
          )}
          {/* 상태 변경 버튼 */}
          <B2bOrderStatusActions
            orderId={detail.order.id}
            status={detail.order.status}
            orderNumber={detail.order.order_number}
          />
        </div>
      </div>

      {/* 주문 상세 (기본 정보 + 품목 + 상태 이력) */}
      <B2bOrderDetailView detail={detail} />

      {/* 출고 내역 */}
      {shipments.length > 0 && (
        <B2bShipmentList shipments={shipments} />
      )}

      {/* 거래명세서 */}
      <B2bStatementList
        statements={statements}
        isAdmin
        onRefresh={handleRefresh}
      />

      {/* 정산 현황 */}
      {settlementSummary && settlementSummary.total_price > 0 && (
        <B2bSettlementSummaryCard summary={settlementSummary} />
      )}

      {/* 정산 내역 */}
      {settlements.length > 0 && (
        <B2bSettlementList settlements={settlements} />
      )}

      {/* 세금계산서 */}
      <B2bTaxInvoiceList
        invoices={taxInvoices}
        isAdmin
        onRefresh={handleRefresh}
      />

      {/* 출고 생성 다이얼로그 */}
      {showShipmentForm && (
        <B2bShipmentForm
          orderId={detail.order.id}
          orderNumber={detail.order.order_number}
          items={detail.items}
          open={showShipmentForm}
          onClose={() => {
            setShowShipmentForm(false)
            handleRefresh()
          }}
        />
      )}

      {/* 거래명세서 생성 다이얼로그 */}
      {showStatementForm && (
        <B2bStatementCreateForm
          orderId={detail.order.id}
          orderNumber={detail.order.order_number}
          items={detail.items}
          open={showStatementForm}
          onClose={() => {
            setShowStatementForm(false)
            handleRefresh()
          }}
        />
      )}

      {/* 정산 생성 다이얼로그 */}
      {showSettlementForm && settlementSummary && (
        <B2bSettlementForm
          orderId={detail.order.id}
          orderNumber={detail.order.order_number}
          summary={settlementSummary}
          open={showSettlementForm}
          onClose={() => {
            setShowSettlementForm(false)
            handleRefresh()
          }}
        />
      )}
    </div>
  )
}
