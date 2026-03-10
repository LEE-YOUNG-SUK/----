'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { getOutstandingReport, getSettlementReport, getDashboardStats } from './actions'
import type { UserData } from '@/types'
import type { B2bOutstandingReportItem, B2bSettlementReportItem, B2bDashboardStats } from '@/types/b2b'
import { toast } from 'sonner'

interface Props {
  session: UserData
}

export function B2bReportClient({ session }: Props) {
  const [tab, setTab] = useState<'dashboard' | 'outstanding' | 'settlement'>('dashboard')
  const [dashboardStats, setDashboardStats] = useState<B2bDashboardStats | null>(null)
  const [outstandingData, setOutstandingData] = useState<B2bOutstandingReportItem[]>([])
  const [settlementData, setSettlementData] = useState<B2bSettlementReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const loadDashboard = async () => {
    const result = await getDashboardStats()
    if (result.success && result.data) {
      setDashboardStats(result.data)
    }
  }

  const loadOutstanding = async () => {
    setLoading(true)
    const result = await getOutstandingReport({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    })
    if (result.success) {
      setOutstandingData(result.data)
    } else {
      toast.error(result.message)
    }
    setLoading(false)
  }

  const loadSettlement = async () => {
    setLoading(true)
    const result = await getSettlementReport({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    })
    if (result.success) {
      setSettlementData(result.data)
    } else {
      toast.error(result.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([loadDashboard(), loadOutstanding(), loadSettlement()])
      setLoading(false)
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    if (tab === 'outstanding') loadOutstanding()
    else if (tab === 'settlement') loadSettlement()
  }

  // 대시보드 통계 합계
  const outstandingTotal = outstandingData.reduce((sum, r) => sum + r.outstanding_amount, 0)
  const settlementTotal = settlementData.reduce((sum, r) => sum + r.total_settled, 0)

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">B2B 정산 리포트</h1>

      {/* 탭 */}
      <div className="flex gap-2 border-b pb-2">
        {(['dashboard', 'outstanding', 'settlement'] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'default' : 'ghost'}
            onClick={() => setTab(t)}
          >
            {t === 'dashboard' ? '대시보드' : t === 'outstanding' ? '미수 현황' : '정산 현황'}
          </Button>
        ))}
      </div>

      {/* 대시보드 탭 */}
      {tab === 'dashboard' && dashboardStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">승인대기 주문</div>
              <div className="text-3xl font-bold mt-1">{dashboardStats.pending_orders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">진행중 주문</div>
              <div className="text-3xl font-bold mt-1">{dashboardStats.active_orders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">미수 총액</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{dashboardStats.total_outstanding.toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">당월 매출</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">{dashboardStats.monthly_sales.toLocaleString()}원</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 기간 필터 (미수/정산 탭에서만) */}
      {tab !== 'dashboard' && (
        <div className="flex items-end gap-3">
          <Input
            label="시작일"
            type="date"
            inputSize="sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            label="종료일"
            type="date"
            inputSize="sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <Button size="sm" onClick={handleSearch} disabled={loading}>
            {loading ? '조회 중...' : '조회'}
          </Button>
        </div>
      )}

      {/* 미수 현황 탭 */}
      {tab === 'outstanding' && (
        <Card>
          <CardHeader>
            <CardTitle>미수 현황 ({outstandingData.length}건, 총 미수: {outstandingTotal.toLocaleString()}원)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">미수 데이터가 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>지점</TableHead>
                    <TableHead className="text-right">주문금액</TableHead>
                    <TableHead className="text-right">정산금액</TableHead>
                    <TableHead className="text-right">미수금액</TableHead>
                    <TableHead className="text-right">정산률</TableHead>
                    <TableHead className="text-right">경과일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingData.map((item) => (
                    <TableRow key={item.order_id}>
                      <TableCell className="font-medium text-sm">{item.order_number}</TableCell>
                      <TableCell className="text-sm">{item.branch_name}</TableCell>
                      <TableCell className="text-right text-sm">{item.total_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">{item.settled_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{item.outstanding_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{item.settlement_rate}%</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.aging_days > 30 ? 'danger' : item.aging_days > 14 ? 'warning' : 'secondary'}>
                          {item.aging_days}일
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 정산 현황 탭 */}
      {tab === 'settlement' && (
        <Card>
          <CardHeader>
            <CardTitle>지점별 정산 현황 ({settlementData.length}개 지점, 총 정산: {settlementTotal.toLocaleString()}원)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {settlementData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">정산 데이터가 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>지점</TableHead>
                    <TableHead className="text-right">주문수</TableHead>
                    <TableHead className="text-right">총 주문금액</TableHead>
                    <TableHead className="text-right">총 정산</TableHead>
                    <TableHead className="text-right">총 미수</TableHead>
                    <TableHead className="text-right">정산률</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementData.map((item) => (
                    <TableRow key={item.branch_id}>
                      <TableCell className="font-medium">{item.branch_name}</TableCell>
                      <TableCell className="text-right text-sm">{item.total_orders}</TableCell>
                      <TableCell className="text-right text-sm">{item.total_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">{item.total_settled.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{item.total_outstanding.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.settlement_rate >= 100 ? 'success' : item.settlement_rate >= 50 ? 'warning' : 'danger'}>
                          {item.settlement_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
