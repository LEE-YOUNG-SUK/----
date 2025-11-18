'use client'

/**
 * 입고 관리 그리드 (AG Grid)
 * 품목 자동완성 통합 버전
 */

import { useCallback, useRef, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef, ICellEditorParams } from 'ag-grid-community'
import type { Product } from '@/types'
import type { PurchaseGridRow } from '@/types/purchases'
import { ProductCellEditor } from './ProductCellEditor'

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
}

export default function PurchaseGrid({ products, onSave, isSaving }: Props) {
  const gridRef = useRef<any>(null)
  const [rowData, setRowData] = useState<PurchaseGridRow[]>([createEmptyRow()])

  function createEmptyRow(): PurchaseGridRow {
    return {
      id: `temp_${Date.now()}_${Math.random()}`,
      product_id: null,
      product_code: '',
      product_name: '',
      category: '',
      unit: '',
      quantity: 0,
      unit_cost: 0,
      total_cost: 0,
      specification: '',
      manufacturer: '',
      notes: ''
    }
  }

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData((prev) => prev.filter((_, index) => index !== rowIndex))
  }, [])

  const handleProductSelect = useCallback((rowIndex: number, product: Product) => {
    setRowData((prev) => {
      const newData = [...prev]
      const currentQty = newData[rowIndex].quantity || 0
      const unitCost = product.standard_purchase_price || 0
      
      newData[rowIndex] = {
        ...newData[rowIndex],
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        manufacturer: product.manufacturer || '',
        unit_cost: unitCost,
        total_cost: currentQty * unitCost
      }
      return newData
    })

    setTimeout(() => {
      gridRef.current?.api?.refreshCells({ force: true })
    }, 0)
  }, [])

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
          handleProductSelect(params.node.rowIndex!, product)
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
      },
      valueSetter: (params) => {
        const newValue = parseFloat(params.newValue) || 0
        params.data.quantity = newValue
        params.data.total_cost = newValue * params.data.unit_cost
        
        // rowData 상태도 업데이트
        setRowData(prev => {
          const newData = [...prev]
          newData[params.node.rowIndex!] = params.data
          return newData
        })
        
        return true
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
      },
      valueSetter: (params) => {
        const newValue = parseFloat(params.newValue) || 0
        params.data.unit_cost = newValue
        params.data.total_cost = params.data.quantity * newValue
        
        // rowData 상태도 업데이트
        setRowData(prev => {
          const newData = [...prev]
          newData[params.node.rowIndex!] = params.data
          return newData
        })
        
        return true
      }
    },
    {
      headerName: '합계',
      field: 'total_cost',
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
    const { data } = params
    data.total_cost = data.quantity * data.unit_cost
    
    // rowData 상태 업데이트
    setRowData(prev => {
      const newData = [...prev]
      newData[params.node.rowIndex] = data
      return newData
    })
    
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['total_cost']
    })
  }, [])

  const handleAddRow = useCallback(() => {
    setRowData((prev) => [...prev, createEmptyRow()])
  }, [])

  const handleClearAll = useCallback(() => {
    if (confirm('모든 입력 데이터를 삭제하시겠습니까?')) {
      setRowData([createEmptyRow()])
    }
  }, [])

  const handleSave = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return

    const data: PurchaseGridRow[] = []
    api.forEachNode((node: any) => {
      if (node.data && node.data.product_id) {
        data.push(node.data)
      }
    })

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

  // 실시간 합계 계산 (rowData 변경 시마다)
  const totalAmount = useMemo(() => {
    const sum = rowData.reduce((acc, row) => {
      const total = (row.quantity || 0) * (row.unit_cost || 0)
      return acc + total
    }, 0)
    console.log('💰 합계 재계산:', sum, rowData)
    return sum
  }, [rowData])
  
  const validRowCount = useMemo(() => 
    rowData.filter((row) => row.product_id).length,
    [rowData]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium shadow-sm"
          >
            ➕ 행 추가
          </button>
          <button
            onClick={handleClearAll}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition font-medium shadow-sm"
          >
            🗑️ 전체 삭제
          </button>
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

      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: false,
            filter: false,
            resizable: true
          }}
          singleClickEdit={false}
          stopEditingWhenCellsLoseFocus={true}
          suppressRowClickSelection={true}
          rowSelection="single"
          animateRows={true}
          enableCellTextSelection={true}
          onCellValueChanged={onCellValueChanged}
        />
      </div>

      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <span className="text-lg">💡</span>
          <span className="font-medium">사용 방법:</span>
          <span>품목코드 셀을 <strong>더블클릭</strong> → 품목명 검색 → <strong>방향키</strong>로 선택 → <strong>Enter</strong>로 확정</span>
        </div>
      </div>
    </div>
  )
}