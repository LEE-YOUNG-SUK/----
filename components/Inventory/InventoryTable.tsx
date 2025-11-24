'use client'

import { useState } from 'react'
import { InventoryLayerModal } from './InventoryLayerModal'
import { ContentCard } from '@/components/shared/ContentCard'

interface InventoryItem {
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  unit: string
  category: string | null
  current_quantity: number
  layer_count: number
  oldest_purchase_date: string | null
  newest_purchase_date: string | null
  avg_unit_cost: number | null
  min_stock_level?: number
}

type StockStatus = '정상' | '부족' | '재고없음'

function calculateStockStatus(
  currentQuantity: number,
  minStockLevel: number = 0
): StockStatus {
  if (currentQuantity === 0) return '재고없음'
  if (currentQuantity <= minStockLevel) return '부족'
  return '정상'
}

const STOCK_STATUS_COLORS = {
  '정상': {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800'
  },
  '부족': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800'
  },
  '재고없음': {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800'
  }
}

const STOCK_STATUS_ICONS = {
  '정상': '✅',
  '부족': '⚠️',
  '재고없음': '🚨'
}

interface Props {
  initialData: InventoryItem[]
  userRole: string
  branchId: string | null
}

export function InventoryTable({ initialData, userRole, branchId }: Props) {
  const [data] = useState(initialData)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  
  // 필터링
  const filteredData = data.filter(item => {
    const matchesSearch = 
      (item.product_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const status = calculateStockStatus(item.current_quantity, item.min_stock_level || 0)
    const matchesStatus = !statusFilter || status === statusFilter
    
    return matchesSearch && matchesStatus
  })
  
  return (
    <>
      <ContentCard>
        {/* 검색 및 필터 */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="품목코드 또는 품목명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체 상태</option>
              <option value="정상">{'✅ 정상'}</option>
              <option value="부족">{'⚠️ 부족'}</option>
              <option value="재고없음">{'🚨 재고없음'}</option>
            </select>
            <div className="text-sm text-gray-600 flex items-center">
              총 <span className="font-semibold mx-1">{filteredData.length}</span>개
            </div>
          </div>
        </div>
        
        {/* 테이블 */}
        <div className="overflow-x-auto -mx-4 sm:-mx-6">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목코드</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지점</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">현재고</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">평균단가</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">재고금액</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter ? '검색 결과가 없습니다.' : '재고가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const status = calculateStockStatus(item.current_quantity, item.min_stock_level || 0)
                  const colors = STOCK_STATUS_COLORS[status]
                  const inventoryValue = item.current_quantity * (item.avg_unit_cost || 0)
                  
                  return (
                    <tr key={`${item.branch_id}-${item.product_id}`} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{item.product_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        {item.category && <div className="text-xs text-gray-500">{item.category}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{item.branch_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.current_quantity.toLocaleString()} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-700">
                          {item.avg_unit_cost ? `₩${item.avg_unit_cost.toLocaleString()}` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {'₩'}{inventoryValue.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {STOCK_STATUS_ICONS[status]} {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.current_quantity > 0 ? (
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition"
                          >
                            {'🔍 상세'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </ContentCard>
      
      {selectedItem && (
        <InventoryLayerModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  )
}