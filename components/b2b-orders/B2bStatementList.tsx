'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { issueStatement, cancelStatement, reissueStatement } from '@/app/b2b-orders/admin/actions'
import { B2B_STATEMENT_STATUS_LABELS } from '@/types/b2b'
import type { B2bTransactionStatement } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  statements: B2bTransactionStatement[]
  isAdmin?: boolean
  onRefresh?: () => void
}

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'secondary'> = {
  draft: 'secondary',
  issued: 'success',
  canceled: 'danger',
}

export function B2bStatementList({ statements, isAdmin, onRefresh }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [dialogType, setDialogType] = useState<'cancel' | 'reissue' | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleIssue = async (statementId: string) => {
    setLoading(statementId)
    try {
      const result = await issueStatement(statementId)
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

  const openDialog = (type: 'cancel' | 'reissue', id: string) => {
    setDialogType(type)
    setTargetId(id)
    setReason('')
  }

  const handleDialogSubmit = async () => {
    if (!targetId || !dialogType) return
    setLoading(targetId)
    try {
      const result = dialogType === 'cancel'
        ? await cancelStatement(targetId, reason || undefined)
        : await reissueStatement(targetId, reason || undefined)

      if (result.success) {
        toast.success(result.message)
        setDialogType(null)
        setTargetId(null)
        setReason('')
        onRefresh?.()
      } else {
        toast.error(result.message)
      }
    } finally {
      setLoading(null)
    }
  }

  // 지점 사용자는 발행된 것만 표시
  const visibleStatements = isAdmin ? statements : statements.filter(s => s.status === 'issued')

  if (visibleStatements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>거래명세서</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-4">거래명세서가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>거래명세서 ({visibleStatements.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>명세서번호</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">공급가</TableHead>
                <TableHead className="text-right">부가세</TableHead>
                <TableHead className="text-right">합계</TableHead>
                <TableHead>발행일</TableHead>
                <TableHead>재발행</TableHead>
                <TableHead className="w-40">{' '}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleStatements.map((stmt) => (
                <>
                  <TableRow key={stmt.id}>
                    <TableCell className="font-medium text-sm">{stmt.statement_number}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[stmt.status] || 'default'}>
                        {B2B_STATEMENT_STATUS_LABELS[stmt.status] || stmt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{stmt.total_supply_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{stmt.total_tax_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{stmt.total_price.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      {stmt.issued_at ? new Date(stmt.issued_at).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {stmt.reissue_count > 0 ? `${stmt.reissue_count}회` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expandedId === stmt.id ? null : stmt.id)}
                        >
                          {expandedId === stmt.id ? '접기' : '상세'}
                        </Button>
                        {isAdmin && stmt.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handleIssue(stmt.id)}
                            disabled={loading === stmt.id}
                          >
                            {loading === stmt.id ? '...' : '발행'}
                          </Button>
                        )}
                        {isAdmin && stmt.status === 'issued' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDialog('reissue', stmt.id)}
                              disabled={loading === stmt.id}
                            >
                              재발행
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                              onClick={() => openDialog('cancel', stmt.id)}
                              disabled={loading === stmt.id}
                            >
                              취소
                            </Button>
                          </>
                        )}
                        {stmt.status === 'issued' && stmt.statement_data && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // 인쇄 전용 윈도우 열기
                              const printWindow = window.open('', '_blank', 'width=800,height=1000')
                              if (printWindow) {
                                printWindow.document.write(generatePrintHtml(stmt))
                                printWindow.document.close()
                              }
                            }}
                          >
                            인쇄
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* 확장 상세 */}
                  {expandedId === stmt.id && stmt.items && (
                    <tr key={`${stmt.id}-detail`}>
                      <td colSpan={8} className="bg-gray-50 p-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">명세서 항목</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">품목</th>
                              <th className="text-right py-1">단가</th>
                              <th className="text-right py-1">수량</th>
                              <th className="text-right py-1">공급가</th>
                              <th className="text-right py-1">부가세</th>
                              <th className="text-right py-1">합계</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stmt.items.map((item) => (
                              <tr key={item.id} className="border-t border-gray-200">
                                <td className="py-1">{item.product_name} <span className="text-gray-400">({item.product_code})</span></td>
                                <td className="text-right py-1">{item.unit_price.toLocaleString()}</td>
                                <td className="text-right py-1">{item.quantity} {item.unit}</td>
                                <td className="text-right py-1">{item.supply_price.toLocaleString()}</td>
                                <td className="text-right py-1">{item.tax_amount.toLocaleString()}</td>
                                <td className="text-right py-1 font-medium">{item.total_price.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {stmt.cancel_reason && (
                          <div className="mt-2 text-sm text-red-600">취소 사유: {stmt.cancel_reason}</div>
                        )}
                        {stmt.memo && (
                          <div className="mt-1 text-sm text-gray-500">메모: {stmt.memo}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 취소/재발행 사유 다이얼로그 */}
      <Dialog open={dialogType !== null} onOpenChange={(v) => { if (!v) { setDialogType(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'cancel' ? '거래명세서 취소' : '거래명세서 재발행'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              label={dialogType === 'cancel' ? '취소 사유' : '재발행 사유'}
              placeholder="사유를 입력해주세요 (선택사항)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              textareaSize="sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogType(null); setReason('') }}>닫기</Button>
            <Button
              variant={dialogType === 'cancel' ? 'destructive' : 'default'}
              onClick={handleDialogSubmit}
              disabled={loading !== null}
            >
              {loading !== null ? '처리 중...' : (dialogType === 'cancel' ? '취소 처리' : '재발행')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 인쇄용 HTML 생성
function generatePrintHtml(stmt: B2bTransactionStatement): string {
  const data = stmt.statement_data
  if (!data) return '<html><body>데이터가 없습니다.</body></html>'

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ccc">${item.product_name}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${item.unit}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right">${item.quantity.toLocaleString()}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right">${item.unit_price.toLocaleString()}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right">${item.supply_price.toLocaleString()}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right">${item.tax_amount.toLocaleString()}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:right;font-weight:bold">${item.total_price.toLocaleString()}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>거래명세서 - ${data.statement_number}</title>
  <style>
    @media print { body { margin: 0; } @page { size: A4; margin: 15mm; } }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
    .info-box h3 { font-size: 13px; color: #666; margin: 0 0 8px; }
    .info-box p { margin: 2px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f5f5f5; padding: 6px 8px; border: 1px solid #ccc; font-size: 11px; }
    .totals { text-align: right; margin-top: 8px; }
    .totals div { margin: 4px 0; font-size: 13px; }
    .totals .total { font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #999; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 40px; font-size: 14px; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <h1>거 래 명 세 서</h1>
  <div style="text-align:right;margin-bottom:12px;font-size:12px;">
    <span>No. ${data.statement_number}</span>
    ${stmt.reissue_count > 0 ? `<span style="color:red;margin-left:8px">(재발행 ${stmt.reissue_count}회)</span>` : ''}
    <span style="margin-left:16px;">발행일: ${data.issue_date}</span>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>공급자</h3>
      <p><strong>${data.provider.name}</strong></p>
      ${data.provider.business_number ? `<p>사업자번호: ${data.provider.business_number}</p>` : ''}
      ${data.provider.address ? `<p>주소: ${data.provider.address}</p>` : ''}
      ${data.provider.phone ? `<p>연락처: ${data.provider.phone}</p>` : ''}
    </div>
    <div class="info-box">
      <h3>공급받는자</h3>
      <p><strong>${data.receiver.name}</strong></p>
      ${data.receiver.business_number ? `<p>사업자번호: ${data.receiver.business_number}</p>` : ''}
      ${data.receiver.address ? `<p>주소: ${data.receiver.address}</p>` : ''}
      ${data.receiver.phone ? `<p>연락처: ${data.receiver.phone}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">품목</th>
        <th>단위</th>
        <th>수량</th>
        <th>단가</th>
        <th>공급가</th>
        <th>부가세</th>
        <th>합계</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div>공급가 합계: ${data.totals.supply_price.toLocaleString()}원</div>
    <div>부가세 합계: ${data.totals.tax_amount.toLocaleString()}원</div>
    <div class="total">총 합계: ${data.totals.total_price.toLocaleString()}원</div>
  </div>

  <div class="footer">
    <p>발행자: ${data.issued_by_name}</p>
  </div>

  <button class="print-btn" onclick="window.print()">인쇄하기</button>
</body>
</html>`
}
