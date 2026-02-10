'use client'

/**
 * 입고 관리 그리드 (AG Grid)
 * 품목 자동완성 통합 버전
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'

// ✅ 그리드 파괴 상태 추적을 위한 전역 플래그
let isGridDestroyed = false
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef, ICellEditorParams } from 'ag-grid-community'
import type { Product } from '@/types'
import type { PurchaseGridRow } from '@/types/purchases'
import { ProductCellEditor } from './ProductCellEditor'
import { Button } from '@/components/ui/Button'

const DeleteButtonRenderer = (props: any) => {
  return (
    <button
      onClick={() => props.handleDeleteRow(props.node.rowIndex)}
      className="w-full h-full text-red-600 hover:bg-red-50 transition"
    >
      ✕ 삭제
    </button>
  )
}

interface Props {
  products: Product[]
  onSave: (items: PurchaseGridRow[]) => void
  isSaving: boolean
  taxIncluded: boolean // 부가세 포함 여부
}

export default function PurchaseGrid({ products, onSave, isSaving, taxIncluded }: Props) {
  const gridRef = useRef<any>(null)
  const isMountedRef = useRef(true)  // ✅ 컴포넌트 마운트 상태 추적
  
  // ✅ 컴포넌트 마운트/언마운트 시 플래그 설정
  useEffect(() => {
    isGridDestroyed = false
    isMountedRef.current = true
    return () => {
      isGridDestroyed = true
      isMountedRef.current = false
    }
  }, [])
  
  const [rowData, setRowData] = useState<PurchaseGridRow[]>(() => {
    // 기본 5개 행 생성
    return Array.from({ length: 5 }, (_, index) => ({
      id: `temp_${Date.now()}_${index}`,
      product_id: null,
      product_code: '',
      product_name: '',
      category: '',
      unit: '',
      quantity: 0,
      unit_cost: 0,
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
      total_cost: 0,
      specification: '',
      manufacturer: '',
      notes: ''
    }))
  })

  /**
   * 자동계산 함수: 수량 * 단가 → 공급가, 부가세, 합계 계산
   * @param row - 계산할 행 데이터
   * @param isTaxIncluded - 부가세 포함 여부
   */
  function calculatePrices(row: PurchaseGridRow, isTaxIncluded: boolean) {
    const quantity = row.quantity || 0
    const inputUnitCost = row.unit_cost || 0  // 사용자가 입력한 단가
    
    if (isTaxIncluded) {
      // 부가세 포함: 수량 * 단가 = 합계
      const totalPrice = quantity * inputUnitCost
      const supplyPrice = Math.round(totalPrice / 1.1)
      const taxAmount = totalPrice - supplyPrice
      
      row.total_price = totalPrice
      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_cost = totalPrice
      // unit_cost는 그대로 유지 (이미 부가세 포함)
    } else {
      // 부가세 미포함: 수량 * 단가 = 공급가
      const supplyPrice = quantity * inputUnitCost
      const taxAmount = Math.round(supplyPrice * 0.1)
      const totalPrice = supplyPrice + taxAmount
      
      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_price = totalPrice
      row.total_cost = totalPrice
      
      // ✅ 핵심: unit_cost를 부가세 포함 단가로 변환 (재고 저장용)
      // 입력 단가 × 1.1 = 부가세 포함 단가
      row.unit_cost = Math.round(inputUnitCost * 1.1)
    }
  }

  // 빈 행 생성 (안정적인 참조를 위해 useMemo 사용)
  const createEmptyRow = useMemo(() => {
    return (): PurchaseGridRow => ({
      id: `temp_${Date.now()}_${Math.random()}`,
      product_id: null,
      product_code: '',
      product_name: '',
      category: '',
      unit: '',
      quantity: 0,
      unit_cost: 0,
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
      total_cost: 0,
      specification: '',
      manufacturer: '',
      notes: ''
    })
  }, [])

  // 부가세 구분 변경 시 전체 행 재계산
  useEffect(() => {
    if (!isMountedRef.current || isGridDestroyed) return  // ✅ 파괴 상태 체크
    if (rowData.length > 0) {
      const updatedData = rowData.map(row => {
        const updatedRow = { ...row }
        calculatePrices(updatedRow, taxIncluded)
        return updatedRow
      })
      setRowData(updatedData)
      
      // 그리드 새로고침
      setTimeout(() => {
        try {
          if (!isGridDestroyed && isMountedRef.current && gridRef.current?.api) {
            gridRef.current.api.refreshCells({ force: true })
          }
        } catch (e) {
          // 그리드 파괴 에러 무시
        }
      }, 0)
    }
  }, [taxIncluded])

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData((prev) => prev.filter((_, index) => index !== rowIndex))
  }, [])

  // RowNode 기반 불변 업데이트 패턴 (정렬/필터 안전)
  const handleProductSelect = useCallback((rowNode: any, product: Product) => {
    if (isGridDestroyed || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const targetId = rowNode?.data?.id
    if (!targetId) return
    
    setRowData(prev => prev.map(r => {
      if (r.id !== targetId) return r
      
      // 전체 객체 새로 생성 (불변 업데이트)
      const updated: PurchaseGridRow = {
        ...r,
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        manufacturer: product.manufacturer || '',
        unit_cost: product.standard_purchase_price || 0  // ✅ 표준 입고 단가 설정
      }
      
      // 자동계산 적용
      calculatePrices(updated, taxIncluded)
      return updated
    }))
    
    // 선택한 행만 강제 리프레시
    setTimeout(() => {
      try {
        if (!isGridDestroyed && isMountedRef.current && gridRef.current?.api && rowNode) {
          gridRef.current.api.refreshCells({
            force: true,
            rowNodes: [rowNode],
            columns: ['product_code', 'product_name', 'unit', 'specification', 'manufacturer', 'supply_price', 'tax_amount', 'total_price']
          })
        }
      } catch (e) {
        // 그리드 파괴 에러 무시
      }
    }, 0)
  }, [taxIncluded])

  const columnDefs = useMemo<ColDef<PurchaseGridRow>[]>(() => [
    {
      headerName: 'No',
      valueGetter: 'node.rowIndex + 1',
      width: 60,
      pinned: 'left',
      cellClass: 'text-center font-medium text-gray-600'
    },
    {
      headerName: '품목코드',
      field: 'product_code',
      width: 150,
      pinned: 'left',
      editable: true,
      cellEditor: ProductCellEditor,
      cellEditorParams: (params: ICellEditorParams) => ({
        products: products,
        onProductSelect: (product: Product) => {
          handleProductSelect(params.node, product)
        },
        stopEditing: () => params.api.stopEditing()
      }),
      cellClass: 'font-medium text-blue-600'
    },
    {
      headerName: '품목명',
      field: 'product_name',
      width: 250,
      editable: false,
      cellClass: 'bg-gray-50'
    },
    {
      headerName: '규격',
      field: 'specification',
      width: 150,
      editable: false,
      cellClass: 'bg-gray-50 text-sm'
    },
    {
      headerName: '제조사',
      field: 'manufacturer',
      width: 120,
      editable: false,
      cellClass: 'bg-gray-50 text-sm'
    },
    {
      headerName: '단위',
      field: 'unit',
      width: 80,
      editable: false,
      cellClass: 'bg-gray-50 text-center font-medium'
    },
    {
      headerName: '수량',
      field: 'quantity',
      width: 100,
      editable: true,
      type: 'numericColumn',
      cellClass: 'text-right',
      valueFormatter: (params) => {
        const value = params.value || 0
        return value.toLocaleString()
      }
    },
    {
      headerName: '단가',
      field: 'unit_cost',
      width: 120,
      editable: true,
      type: 'numericColumn',
      cellClass: 'text-right',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '공급가',
      field: 'supply_price',
      width: 130,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-gray-50 text-right font-medium',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '부가세',
      field: 'tax_amount',
      width: 120,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-gray-50 text-right font-medium text-orange-600',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '합계',
      field: 'total_price',
      width: 140,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-blue-50 text-right font-bold text-blue-700',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '비고',
      field: 'notes',
      width: 200,
      editable: true,
      cellClass: 'text-sm'
    },
    {
      headerName: '삭제',
      width: 80,
      pinned: 'right',
      cellRenderer: DeleteButtonRenderer,
      cellRendererParams: {
        handleDeleteRow: handleDeleteRow
      }
    }
  ], [handleDeleteRow, handleProductSelect, products])

  const onCellValueChanged = useCallback((params: any) => {
    if (isGridDestroyed || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const { data } = params
    
    // 자동계산 적용
    calculatePrices(data, taxIncluded)
    
    // rowData 상태 업데이트 (id 기반 불변 업데이트)
    setRowData(prev => {
      if (!isMountedRef.current) return prev  // ✅ 추가 체크
      return prev.map(r => r.id === data.id ? data : r)
    })
    
    // 계산된 필드들 새로고침
    try {
      if (!isGridDestroyed && isMountedRef.current && params.api && params.node) {
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['supply_price', 'tax_amount', 'total_price', 'total_cost']
        })
      }
    } catch (e) {
      // 그리드 파괴 에러 무시
    }
  }, [taxIncluded])

  const handleAddRow = useCallback(() => {
    const newRow = createEmptyRow()
    setRowData((prev) => [...prev, newRow])
  }, [createEmptyRow])

  const handleClearAll = useCallback(() => {
    if (confirm('모든 입력 데이터를 삭제하시겠습니까?')) {
      setRowData([createEmptyRow()])
    }
  }, [createEmptyRow])

  const handleSave = useCallback(() => {
    if (isGridDestroyed || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const api = gridRef.current?.api
    if (!api) return

    const data: PurchaseGridRow[] = []
    try {
      api.forEachNode((node: any) => {
        if (node.data && node.data.product_id) {
          data.push(node.data)
        }
      })
    } catch (e) {
      console.error('Grid API error:', e)
      return
    }

    if (data.length === 0) {
      alert('입고할 품목을 입력해주세요.')
      return
    }

    const errors: string[] = []
    data.forEach((item, index) => {
      if (!item.product_id) {
        errors.push(`${index + 1}번째 행: 품목을 선택해주세요.`)
      }
      if (item.quantity <= 0) {
        errors.push(`${index + 1}번째 행: 수량을 입력해주세요.`)
      }
      if (item.unit_cost <= 0) {
        errors.push(`${index + 1}번째 행: 단가를 입력해주세요.`)
      }
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
      return
    }

    onSave(data)
  }, [onSave])

  // 실시간 합계 계산 - total_price 사용 (부가세 반영된 최종 금액)
  const totalAmount = useMemo(() => 
    rowData.reduce((acc, row) => acc + (row.total_price || 0), 0),
  [rowData])
  
  const validRowCount = useMemo(() => 
    rowData.filter((row) => row.product_id).length,
    [rowData]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleAddRow} disabled={isSaving}>
            ➕ 행 추가
          </Button>
          <Button variant="secondary" onClick={handleClearAll} disabled={isSaving}>
            🗑️ 전체 삭제
          </Button>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="text-gray-600">입력 품목:</span>
            <span className="ml-2 font-bold text-lg text-blue-600">
              {validRowCount}
            </span>
            <span className="text-gray-500 ml-1">개</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">합계 금액:</span>
            <span className="ml-2 font-bold text-lg text-red-600">
              ₩{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || validRowCount === 0}
            className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold shadow-lg"
          >
            {isSaving ? '💾 저장 중...' : '💾 일괄 저장'}
          </button>
        </div>
      </div>

      <div className="flex-1 ag-theme-alpine" style={{ minHeight: '300px' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
            minWidth: 100
          }}
          singleClickEdit={false}
          stopEditingWhenCellsLoseFocus={true}
          suppressMovableColumns={true}
          rowHeight={40}
          headerHeight={45}
          onCellValueChanged={onCellValueChanged}
        />
      </div>

      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs sm:text-sm text-blue-800">
          <span className="text-lg">💡</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-medium">사용 방법:</span>
            <span className="hidden sm:inline">품목코드 셀을 <strong>더블클릭</strong> → 품목명 검색 → <strong>방향키</strong>로 선택 → <strong>Enter</strong>로 확정</span>
            <span className="sm:hidden">품목코드 셀 <strong>더블클릭</strong> → 검색 → <strong>Enter</strong> 확정</span>
          </div>
        </div>
      </div>
    </div>
  )
}