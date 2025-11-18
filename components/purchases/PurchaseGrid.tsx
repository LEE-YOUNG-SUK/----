'use client'

/**
 * 입고 관리 그리드 (AG Grid)
 * 중첩 dynamic import 제거 및 React 렌더러 사용
 */

import { useCallback, useRef, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef } from 'ag-grid-community'
import type { Product } from '@/types'
import type { PurchaseGridRow } from '@/types/purchases'

// 삭제 버튼을 React 컴포넌트로 분리
const DeleteButtonRenderer = (props: any) => {
  const onClick = () => {
    props.handleDeleteRow(props.node.rowIndex)
  }

  return (
    <button
      onClick={onClick}
      className="w-full h-full text-red-600 hover:bg-red-50"
    >
      삭제
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

  // 빈 행 생성
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

  // 행 삭제
  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData((prev) => prev.filter((_, index) => index !== rowIndex))
  }, [])

  // 컬럼 정의
  const columnDefs = useMemo<ColDef<PurchaseGridRow>[]>(() => [
    {
      headerName: 'No',
      valueGetter: 'node.rowIndex + 1',
      width: 60,
      pinned: 'left',
      cellClass: 'text-center'
    },
    {
      headerName: '품목코드',
      field: 'product_code',
      width: 150,
      pinned: 'left',
      editable: true,
      cellEditor: 'agTextCellEditor'
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
      cellClass: 'bg-gray-50'
    },
    {
      headerName: '제조사',
      field: 'manufacturer',
      width: 120,
      editable: false,
      cellClass: 'bg-gray-50'
    },
    {
      headerName: '단위',
      field: 'unit',
      width: 80,
      editable: false,
      cellClass: 'bg-gray-50 text-center'
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
        return true
      }
    },
    {
      headerName: '합계',
      field: 'total_cost',
      width: 140,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-blue-50 text-right font-semibold',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '비고',
      field: 'notes',
      width: 200,
      editable: true
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
  ], [handleDeleteRow])

  // 셀 편집 완료 시
  const onCellValueChanged = useCallback((params: any) => {
    const { data } = params
    data.total_cost = data.quantity * data.unit_cost
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['total_cost']
    })
  }, [])

  // 행 추가
  const handleAddRow = useCallback(() => {
    setRowData((prev) => [...prev, createEmptyRow()])
  }, [])

  // 전체 삭제
  const handleClearAll = useCallback(() => {
    if (confirm('모든 입력 데이터를 삭제하시겠습니까?')) {
      setRowData([createEmptyRow()])
    }
  }, [])

  // 저장
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

    // 유효성 검사
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

  // 합계 계산
  const totalAmount = useMemo(() => 
    rowData.reduce((sum, row) => sum + (row.total_cost || 0), 0),
    [rowData]
  )
  
  const validRowCount = useMemo(() => 
    rowData.filter((row) => row.product_id).length,
    [rowData]
  )

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            + 행 추가
          </button>
          <button
            onClick={handleClearAll}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            전체 삭제
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-600">입력 품목:</span>
            <span className="ml-2 font-semibold text-blue-600">
              {validRowCount}개
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">합계 금액:</span>
            <span className="ml-2 font-semibold text-red-600">
              ₩{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || validRowCount === 0}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-semibold"
          >
            {isSaving ? '저장 중...' : '일괄 저장'}
          </button>
        </div>
      </div>

      {/* 그리드 */}
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
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          suppressRowClickSelection={true}
          rowSelection="single"
          animateRows={true}
          enableCellTextSelection={true}
          onCellValueChanged={onCellValueChanged}
        />
      </div>

      {/* 안내 메시지 */}
      <div className="p-2 bg-gray-50 border-t text-xs text-gray-600">
        💡 품목코드 셀을 더블클릭하여 품목을 입력하세요. 수량과 단가를 입력하면 합계가 자동 계산됩니다.
      </div>
    </div>
  )
}