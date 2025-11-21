'use client'

/**
 * 판매 관리 그리드 (AG Grid)
 * 입고 관리(PurchaseGrid) 구조 100% 적용
 */

import { useCallback, useRef, useState, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef, ICellEditorParams } from 'ag-grid-community'
import type { ProductWithStock, SaleGridRow } from '@/types/sales'
import { ProductCellEditor } from './salescelleditor'

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
  products: ProductWithStock[]
  onSave: (items: SaleGridRow[]) => void
  isSaving: boolean
}

export default function SaleGrid({ products, onSave, isSaving }: Props) {
  const gridRef = useRef<any>(null)
  const [rowData, setRowData] = useState<SaleGridRow[]>([createEmptyRow()])

  function createEmptyRow(): SaleGridRow {
    return {
      id: `temp_${Date.now()}_${Math.random()}`,
      product_id: null,
      product_code: '',
      product_name: '',
      category: '',
      unit: '',
      specification: '',
      manufacturer: '',
      current_stock: 0,
      quantity: 0,
      unit_price: 0,
      total_amount: 0,
      notes: ''
    }
  }

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData((prev) => prev.filter((_, index) => index !== rowIndex))
  }, [])

  const handleProductSelect = useCallback((rowIndex: number, product: ProductWithStock) => {
    setRowData((prev) => {
      const newData = [...prev];
      const currentQty = newData[rowIndex].quantity || 0;
      const unitPrice = product.standard_sale_price || 0;
      
      newData[rowIndex] = {
        ...newData[rowIndex],
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        manufacturer: product.manufacturer || '',
        current_stock: product.current_stock,
        unit_price: unitPrice,
        total_amount: currentQty * unitPrice,
      };

      return newData;
    })

    setTimeout(() => {
      gridRef.current?.api?.refreshCells({ force: true })
    }, 0)
  }, [])

  const columnDefs = useMemo<ColDef<SaleGridRow>[]>(() => [
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
        onProductSelect: (product: ProductWithStock) => {
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
      headerName: '재고',
      field: 'current_stock',
      width: 100,
      editable: false,
      type: 'numericColumn',
      cellClass: (params) => {
        const stock = params.value || 0
        return stock <= 0 
          ? 'bg-red-50 text-red-700 font-bold text-center' 
          : 'bg-green-50 text-green-700 font-bold text-center'
      },
      valueFormatter: (params) => {
        const value = params.value || 0
        return value.toLocaleString()
      }
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
      field: 'unit_price',
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
      headerName: '합계',
      field: 'total_amount',
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
    const { data, node } = params

    // Update total_amount based on quantity and unit_price
    data.total_amount = data.quantity * data.unit_price

    if (node && node.rowIndex !== null && node.rowIndex !== undefined) {
      setRowData((prev) => {
        const newData = [...prev]
        newData[node.rowIndex as number] = {
          ...newData[node.rowIndex as number],
          ...data, // Ensure all fields are updated
        }
        return newData
      })
    }

    // Refresh only the updated row and total_amount column
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['total_amount'],
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

    const data: SaleGridRow[] = []
    api.forEachNode((node: any) => {
      if (node.data && node.data.product_id) {
        data.push(node.data)
      }
    })

    if (data.length === 0) {
      alert('판매할 품목을 입력해주세요.')
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
      if (item.unit_price <= 0) {
        errors.push(`${index + 1}번째 행: 단가를 입력해주세요.`)
      }
      if (item.quantity > item.current_stock) {
        errors.push(`${index + 1}번째 행: 재고가 부족합니다. (재고: ${item.current_stock})`)
      }
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
      return
    }

    onSave(data)
  }, [onSave])

  const totalAmount = useMemo(() => {
    const sum = rowData.reduce((acc, row) => {
      const total = (row.quantity || 0) * (row.unit_price || 0)
      return acc + total
    }, 0)
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
            sortable: true,
            resizable: true
          }}
          onCellValueChanged={onCellValueChanged}
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={false}
          suppressMovableColumns={true}
          rowHeight={40}
          headerHeight={45}
        />
      </div>
    </div>
  )
}