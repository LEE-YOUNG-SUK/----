'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { approveOrder, holdOrder, resumeOrder, cancelOrder } from '@/app/b2b-orders/admin/actions'
import type { B2bOrderStatus } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  orderId: string
  status: B2bOrderStatus
  orderNumber: string
}

export function B2bOrderStatusActions({ orderId, status, orderNumber }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dialogType, setDialogType] = useState<'hold' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    try {
      const result = await approveOrder(orderId)
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResume = async () => {
    setLoading(true)
    try {
      const result = await resumeOrder(orderId)
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleHoldSubmit = async () => {
    if (!reason.trim()) {
      toast.error('보류 사유를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const result = await holdOrder(orderId, reason)
      if (result.success) {
        toast.success(result.message)
        setDialogType(null)
        setReason('')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubmit = async () => {
    if (!reason.trim()) {
      toast.error('취소 사유를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const result = await cancelOrder(orderId, reason)
      if (result.success) {
        toast.success(result.message)
        setDialogType(null)
        setReason('')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // 현재 상태에 따라 가능한 액션 결정
  const actions: React.ReactNode[] = []

  if (status === 'pending_approval') {
    actions.push(
      <Button key="approve" onClick={handleApprove} disabled={loading} size="sm">
        승인
      </Button>
    )
    actions.push(
      <Button key="hold" variant="outline" onClick={() => setDialogType('hold')} disabled={loading} size="sm">
        보류
      </Button>
    )
    actions.push(
      <Button key="cancel" variant="destructive" onClick={() => setDialogType('cancel')} disabled={loading} size="sm">
        취소
      </Button>
    )
  }

  if (status === 'approved') {
    actions.push(
      <Button key="hold" variant="outline" onClick={() => setDialogType('hold')} disabled={loading} size="sm">
        보류
      </Button>
    )
    actions.push(
      <Button key="cancel" variant="destructive" onClick={() => setDialogType('cancel')} disabled={loading} size="sm">
        취소
      </Button>
    )
  }

  if (status === 'on_hold') {
    actions.push(
      <Button key="resume" onClick={handleResume} disabled={loading} size="sm">
        보류 해제
      </Button>
    )
    actions.push(
      <Button key="cancel" variant="destructive" onClick={() => setDialogType('cancel')} disabled={loading} size="sm">
        취소
      </Button>
    )
  }

  if (actions.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-2">
        {actions}
      </div>

      {/* 보류/취소 사유 입력 다이얼로그 */}
      <Dialog open={dialogType !== null} onOpenChange={(v) => { if (!v) { setDialogType(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'hold' ? '주문 보류' : '주문 취소'} - {orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              label={dialogType === 'hold' ? '보류 사유' : '취소 사유'}
              placeholder={dialogType === 'hold' ? '보류 사유를 입력해주세요...' : '취소 사유를 입력해주세요...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              textareaSize="sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogType(null); setReason('') }}>
              닫기
            </Button>
            <Button
              variant={dialogType === 'cancel' ? 'destructive' : 'default'}
              onClick={dialogType === 'hold' ? handleHoldSubmit : handleCancelSubmit}
              disabled={loading || !reason.trim()}
            >
              {loading ? '처리 중...' : (dialogType === 'hold' ? '보류 처리' : '취소 처리')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
