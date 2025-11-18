'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

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

interface InventoryLayer {
  layer_id: string
  purchase_date: string
  unit_cost: number
  original_quantity: number
  consumed_quantity: number
  remaining_quantity: number
  layer_value: number
  reference_number: string | null
}

interface Props {
  item: InventoryItem
  onClose: () => void
}

export function InventoryLayerModal({ item, onClose }: Props) {
  const [layers, setLayers] = useState<InventoryLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  useEffect(() => {
    loadLayers()
  }, [item])
  
  const loadLayers = async () => {
    setLoading(true)
    setError('')
    
    try {
      const { data, error: rpcError } = await supabase.rpc('get_inventory_layers_detail', {
        p_branch_id: item.branch_id,
        p_product_id: item.product_id
      })
      
      if (rpcError) throw rpcError
      
      setLayers(data || [])
    } catch (err: any) {
      console.error('❌ 레이어 조회 실패:', err)
      setError(err.message || '레이어 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                📦 FIFO 레이어 상세
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {item.product_code} - {item.product_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 요약 정보 */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-blue-600 mb-1">지점</p>
              <p className="font-semibold text-blue-900">{item.branch_name}</p>
            </div>
            <div>
              <p className="text-blue-600 mb-1">현재 재고</p>
              <p className="font-semibold text-blue-900">
                {item.current_quantity.toLocaleString()} {item.unit}
              </p>
            </div>
            <div>
              <p className="text-blue-600 mb-1">평균 단가</p>
              <p className="font-semibold text-blue-900">
                {item.avg_unit_cost ? `₩${item.avg_unit_cost.toLocaleString()}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-blue-600 mb-1">레이어 수</p>
              <p className="font-semibold text-blue-900">{item.layer_count}개</p>
            </div>
          </div>
        </div>
        
        {/* 레이어 테이블 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">데이터 로딩 중...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}
          
          {!loading && !error && layers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">📭 재고 레이어가 없습니다.</p>
            </div>
          )}
          
          {!loading && !error && layers.length > 0 && (
            <>
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  💡 <strong>FIFO (First-In-First-Out)</strong>: 먼저 입고된 레이어부터 판매 시 차감됩니다.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">입고일</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">단가</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">입고수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">소진수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">남은수량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">레이어금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참조번호</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {layers.map((layer, index) => {
                      const isActive = layer.remaining_quantity > 0
                      const rowBg = isActive ? 'bg-white' : 'bg-gray-50'
                      
                      return (
                        <tr key={layer.layer_id || index} className={rowBg}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(layer.purchase_date).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            ₩{layer.unit_cost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {layer.original_quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {layer.consumed_quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className={`font-semibold ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                              {layer.remaining_quantity.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            ₩{layer.layer_value.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {layer.reference_number || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        합계
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                        {layers.reduce((sum, l) => sum + l.remaining_quantity, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        ₩{layers.reduce((sum, l) => sum + l.layer_value, 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
        
        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
          >
            닫기
          </button>
        </div>
        
      </div>
    </div>
  )
}