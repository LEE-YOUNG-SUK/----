"use client"
/**
 * 판매 관리 그리드 (AG Grid)
 * 입고 그리드 VAT 계산 패턴 적용
 */
import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef, ICellEditorParams } from 'ag-grid-community'
import type { ProductWithStock, SaleGridRow } from '@/types/sales'
import { ProductCellEditor } from './salescelleditor'

const DeleteButtonRenderer = (props: any) => (
  <button
    onClick={() => props.handleDeleteRow(props.node.rowIndex)}
    className="w-full h-full text-red-600 hover:bg-red-50 transition"
  >
    ✕ 삭제
  </button>
)

interface Props {
  products: ProductWithStock[]
  onSave: (items: SaleGridRow[]) => void
  isSaving: boolean
  taxIncluded: boolean
}

export default function SaleGrid({ products, onSave, isSaving, taxIncluded }: Props) {
  const gridRef = useRef<any>(null)
  const [rowData, setRowData] = useState<SaleGridRow[]>(() => {
    // 기본 5개 행 생성
    return Array.from({ length: 5 }, (_, index) => ({
      id: `temp_${Date.now()}_${index}`,
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
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
      total_amount: 0,
      notes: ''
    }))
  })

  // 빈 행 생성 (안정적인 참조를 위해 useMemo 사용)
  const createEmptyRow = useMemo(() => {
    return (): SaleGridRow => ({
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
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
      total_amount: 0,
      notes: ''
    })
  }, [])

  function calculatePrices(row: SaleGridRow, isTaxIncluded: boolean) {
    const qty = row.quantity || 0
    const unit = row.unit_price || 0
    if (isTaxIncluded) {
      const total = qty * unit
      const supply = Math.round(total / 1.1)
      const tax = total - supply
      row.supply_price = supply
      row.tax_amount = tax
      row.total_price = total
      row.total_amount = total
    } else {
      const supply = qty * unit
      const tax = Math.round(supply * 0.1)
      const total = supply + tax
      row.supply_price = supply
      row.tax_amount = tax
      row.total_price = total
      row.total_amount = total
    }
  }

  // 부가세 구분 변경 시 전체 재계산
  useEffect(() => {
    setRowData(prev => prev.map(r => {
      const copy = { ...r }
      calculatePrices(copy, taxIncluded)
      return copy
    }))
    setTimeout(() => gridRef.current?.api?.refreshCells({ force: true }), 0)
  }, [taxIncluded])

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData(prev => prev.filter((_, i) => i !== rowIndex))
  }, [])

  // 행 인덱스 기반 직접 변경 → 정렬/필터 후 잘못된 행 갱신 가능성 있으므로 RowNode와 id를 기준으로 불변 업데이트
  const handleProductSelect = useCallback((rowNode: any, product: ProductWithStock) => {
    const targetId = rowNode?.data?.id
    if (!targetId) return
    setRowData(prev => prev.map(r => {
      if (r.id !== targetId) return r
      const updated: SaleGridRow = {
        ...r,
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        manufacturer: product.manufacturer || '',
        current_stock: product.current_stock,
        unit_price: product.standard_sale_price || 0
      }
      calculatePrices(updated, taxIncluded)
      return updated
    }))
    // 선택한 행만 강제 리프레시 (rowNode 그대로 사용)
    setTimeout(() => {
      if (gridRef.current?.api && rowNode) {
        gridRef.current.api.refreshCells({
          force: true,
          rowNodes: [rowNode],
          columns: ['product_code','product_name','unit','current_stock','unit_price','supply_price','tax_amount','total_price']
        })
      }
    }, 0)
  }, [taxIncluded])

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
          handleProductSelect(params.node, product)
        },
        stopEditing: () => params.api.stopEditing()
      }),
      valueSetter: (params) => {
        // 품목 선택 시 코드가 제대로 설정되도록 보장
        if (params.newValue && params.newValue !== params.oldValue) {
          params.data.product_code = params.newValue
          return true
        }
        return false
      },
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
      headerName: '공급가',
      field: 'supply_price',
      width: 130,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-gray-50 text-right font-medium',
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
    },
    {
      headerName: '부가세',
      field: 'tax_amount',
      width: 120,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-gray-50 text-right font-medium text-orange-600',
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
    },
    {
      headerName: '합계',
      field: 'total_price',
      width: 140,
      editable: false,
      type: 'numericColumn',
      cellClass: 'bg-blue-50 text-right font-bold text-blue-700',
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
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
    calculatePrices(data, taxIncluded)
    setRowData(prev => {
      const copy = [...prev]
      copy[params.node.rowIndex] = data
      return copy
    })
    params.api.refreshCells({
      rowNodes: [params.node],
      columns: ['supply_price','tax_amount','total_price','total_amount']
    })
  }, [taxIncluded])

  const handleAddRow = useCallback(() => {
    console.log('행 추가 버튼 클릭됨')
    const newRow = createEmptyRow()
    console.log('새 행 생성:', newRow)
    setRowData((prev) => {
      const updated = [...prev, newRow]
      console.log('업데이트된 행 수:', updated.length)
      return updated
    })
  }, [createEmptyRow])

  const handleClearAll = useCallback(() => {
    if (confirm('모든 입력 데이터를 삭제하시겠습니까?')) {
      setRowData([createEmptyRow()])
    }
  }, [createEmptyRow])

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

  const totalAmount = useMemo(() => rowData.reduce((acc, r) => acc + (r.total_price || 0), 0), [rowData])
  
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
          onCellValueChanged={onCellValueChanged}
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={false}
          suppressMovableColumns={true}
          rowHeight={40}
          headerHeight={45}
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