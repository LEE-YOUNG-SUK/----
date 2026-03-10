'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { updateTaxInvoiceStatus } from '@/app/b2b-orders/admin/tax-invoices/actions'
import { B2B_TAX_INVOICE_STATUS_LABELS } from '@/types/b2b'
import type { B2bTaxInvoice, B2bTaxInvoiceStatus } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  invoices: B2bTaxInvoice[]
  isAdmin?: boolean
  onRefresh?: () => void
}

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'secondary'> = {
  pending: 'secondary',
  requested: 'warning',
  issued: 'success',
  failed: 'danger',
  canceled: 'danger',
}

export function B2bTaxInvoiceList({ invoices, isAdmin, onRefresh }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [dialogType, setDialogType] = useState<'issue' | 'fail' | 'cancel' | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [providerId, setProviderId] = useState('')
  const [failureReason, setFailureReason] = useState('')

  // 지점 사용자는 issued만 표시
  const visibleInvoices = isAdmin ? invoices : invoices.filter(i => i.status === 'issued')

  const handleStatusChange = async (invoiceId: string, status: B2bTaxInvoiceStatus) => {
    setLoading(invoiceId)
    try {
      const result = await updateTaxInvoiceStatus(invoiceId, status)
      if (result.success) {
        toast.success(result.message)
        onRefresh?.()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(null)
    }
  }

  const openDialog = (type: 'issue' | 'fail' | 'cancel', id: string) => {
    setDialogType(type)
    setTargetId(id)
    setProviderId('')
    setFailureReason('')
  }

  const handleDialogSubmit = async () => {
    if (!targetId || !dialogType) return
    setLoading(targetId)
    try {
      let result
      if (dialogType === 'issue') {
        result = await updateTaxInvoiceStatus(targetId, 'issued', providerId || undefined)
      } else if (dialogType === 'fail') {
        result = await updateTaxInvoiceStatus(targetId, 'failed', undefined, failureReason || undefined)
      } else {
        result = await updateTaxInvoiceStatus(targetId, 'canceled')
      }

      if (result.success) {
        toast.success(result.message)
        setDialogType(null)
        onRefresh?.()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(null)
    }
  }

  if (visibleInvoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>세금계산서</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-4">세금계산서가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>세금계산서 ({visibleInvoices.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>계산서번호</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">공급가</TableHead>
                <TableHead className="text-right">부가세</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead>발행일</TableHead>
                <TableHead>메모</TableHead>
                {isAdmin && <TableHead className="w-40">{' '}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-sm">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[inv.status] || 'default'}>
                      {B2B_TAX_INVOICE_STATUS_LABELS[inv.status] || inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{inv.supply_price.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">{inv.tax_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{inv.total_price.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">
                    {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{inv.memo || '-'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        {inv.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(inv.id, 'requested')}
                            disabled={loading === inv.id}
                          >
                            발행요청
                          </Button>
                        )}
                        {inv.status === 'requested' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openDialog('issue', inv.id)}
                              disabled={loading === inv.id}
                            >
                              발행완료
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                              onClick={() => openDialog('fail', inv.id)}
                              disabled={loading === inv.id}
                            >
                              실패
                            </Button>
                          </>
                        )}
                        {inv.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(inv.id, 'requested')}
                            disabled={loading === inv.id}
                          >
                            재요청
                          </Button>
                        )}
                        {['pending', 'requested', 'failed'].includes(inv.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500"
                            onClick={() => openDialog('cancel', inv.id)}
                            disabled={loading === inv.id}
                          >
                            취소
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 발행완료/실패/취소 다이얼로그 */}
      <Dialog open={dialogType !== null} onOpenChange={(v) => { if (!v) setDialogType(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'issue' ? '세금계산서 발행 완료' :
               dialogType === 'fail' ? '세금계산서 발행 실패' : '세금계산서 취소'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {dialogType === 'issue' && (
              <Input
                label="외부 발행 ID"
                inputSize="sm"
                placeholder="홈택스 등 외부 시스템 발행 ID (선택)"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
              />
            )}
            {dialogType === 'fail' && (
              <Textarea
                label="실패 사유"
                textareaSize="sm"
                placeholder="발행 실패 사유를 입력해주세요"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
              />
            )}
            {dialogType === 'cancel' && (
              <p className="text-sm text-gray-600">세금계산서를 취소하시겠습니까?</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>닫기</Button>
            <Button
              variant={dialogType === 'cancel' || dialogType === 'fail' ? 'destructive' : 'default'}
              onClick={handleDialogSubmit}
              disabled={loading !== null}
            >
              {loading !== null ? '처리 중...' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
