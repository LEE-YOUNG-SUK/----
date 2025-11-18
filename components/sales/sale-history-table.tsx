// components/sales/sale-history-table.tsx
'use client'

import { useState, useEffect } from 'react'
import { SaleHistory } from '@/types/sales'
import { getSalesHistory } from '@/app/sales/actions'

interface SaleHistoryTableProps {
  branchId: string;
}

export default function SaleHistoryTable({ branchId }: SaleHistoryTableProps) {
  const [history, setHistory] = useState<SaleHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadHistory = async () => {
    if (!branchId) return
    
    setLoading(true)
    try {
      const result = await getSalesHistory(branchId, startDate, endDate)
      if (result.success) {
        setHistory(result.data)
      } else {
        console.error('내역 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('내역 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [branchId])

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4">
      {/* 검색 필터 */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadHistory}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          조회
        </button>
      </div>

      {/* 테이블 */}
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          판매 내역이 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">품목</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">수량</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매단가</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매금액</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">원가</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">이익</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">이익률</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참조번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록자</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {new Date(item.sale_date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{item.customer_name}</td>
                  <td className="px-4 py-3 text-sm">{item.product_name}</td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    ₩{item.unit_price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-medium text-blue-600">
                    ₩{item.total_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap text-gray-600">
                    ₩{item.cost_of_goods.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-medium text-green-600">
                    ₩{item.profit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    <span className={`font-medium ${
                      Number(item.profit_rate) >= 20 ? 'text-green-600' : 
                      Number(item.profit_rate) >= 10 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {item.profit_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
                    {item.reference_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
                    {item.created_by_name}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm text-right">합계:</td>
                <td className="px-4 py-3 text-sm text-right text-blue-600">
                  ₩{history.reduce((sum, item) => sum + item.total_amount, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-600">
                  ₩{history.reduce((sum, item) => sum + item.cost_of_goods, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right text-green-600">
                  ₩{history.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {history.length > 0 ? (
                    <span className="font-medium text-green-600">
                      {(
                        (history.reduce((sum, item) => sum + item.profit, 0) / 
                         history.reduce((sum, item) => sum + item.total_amount, 0)) * 100
                      ).toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}