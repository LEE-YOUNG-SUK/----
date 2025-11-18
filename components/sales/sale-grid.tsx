// components/sales/sale-grid.tsx
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, ValueSetterParams, CellStyle } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { SaleRow, ProductWithStock } from '@/types/sales'
import { v4 as uuidv4 } from 'uuid'
import ProductCellEditor from './product-cell-editor'

interface SaleGridProps {
  products: ProductWithStock[];
  onDataChange: (data: SaleRow[]) => void;
  onTotalChange: (total: number) => void;
}

// 삭제 버튼 렌더러
const DeleteButtonRenderer = (props: any) => {
  return (
    <button
      onClick={() => props.handleDeleteRow(props.node.rowIndex)}
      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
    >
      삭제
    </button>
  )
}

export default function SaleGrid({ products, onDataChange, onTotalChange }: SaleGridProps) {
  console.log('🎨 SaleGrid 렌더링, products:', products)
  console.log('📊 products 개수:', products.length)
  
  const [rowData, setRowData] = useState<SaleRow[]>([
    {
      id: uuidv4(),
      product_code: '',
      product_name: '',
      specification: '',
      manufacturer: '',
      unit: '',
      quantity: 0,
      unit_price: 0,
      total_amount: 0,
      current_stock: 0
    }
  ])

  // 합계 계산
  useEffect(() => {
    const total = rowData.reduce((sum, row) => sum + (row.total_amount || 0), 0)
    onTotalChange(total)
  }, [rowData, onTotalChange])

  // 데이터 변경 시 부모에게 알림
  useEffect(() => {
    onDataChange(rowData)
  }, [rowData, onDataChange])

  // 행 삭제
  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData(prev => {
      if (prev.length === 1) {
        // 마지막 행은 초기화
        return [{
          id: uuidv4(),
          product_code: '',
          product_name: '',
          specification: '',
          manufacturer: '',
          unit: '',
          quantity: 0,
          unit_price: 0,
          total_amount: 0,
          current_stock: 0
        }]
      }
      return prev.filter((_, idx) => idx !== rowIndex)
    })
  }, [])

  // 품목 선택 시 데이터 자동 채우기
  const handleProductSelect = useCallback((rowIndex: number, product: ProductWithStock) => {
    setRowData(prev => {
      const newData = [...prev]
      newData[rowIndex] = {
        ...newData[rowIndex],
        id: product.id,
        product_code: product.code,
        product_name: product.name,
        specification: product.specification,
        manufacturer: product.manufacturer,
        unit: product.unit,
        unit_price: product.standard_sale_price,
        current_stock: product.current_stock,
        total_amount: newData[rowIndex].quantity * product.standard_sale_price
      }
      return newData
    })
  }, [])

  const columnDefs = useMemo<ColDef<SaleRow>[]>(() => [
    {
      headerName: '품목코드',
      field: 'product_code',
      width: 120,
      editable: true,
      cellEditor: ProductCellEditor,
      cellEditorParams: {
        products,
        onProductSelect: handleProductSelect
      }
    },
    {
      headerName: '품목명',
      field: 'product_name',
      width: 200,
      editable: false
    },
    {
      headerName: '규격',
      field: 'specification',
      width: 150,
      editable: false
    },
    {
      headerName: '제조사',
      field: 'manufacturer',
      width: 120,
      editable: false
    },
    {
      headerName: '단위',
      field: 'unit',
      width: 80,
      editable: false
    },
    {
      headerName: '재고',
      field: 'current_stock',
      width: 100,
      editable: false,
      cellStyle: (params): CellStyle => {
        if (!params.value) {
          return { color: '#999' }
        }
        return params.value < 10 
          ? { color: '#dc2626', fontWeight: 'bold' }
          : { color: '#16a34a', fontWeight: 'bold' }
      },
      valueFormatter: params => params.value ? params.value.toLocaleString() : '-'
    },
    {
      headerName: '판매수량',
      field: 'quantity',
      width: 100,
      editable: true,
      type: 'numericColumn',
      valueSetter: (params: ValueSetterParams<SaleRow>) => {
        const newValue = Number(params.newValue) || 0
        
        // 재고 부족 체크
        if (newValue > params.data.current_stock) {
          alert(`재고 부족! 현재 재고: ${params.data.current_stock}${params.data.unit}`)
          return false
        }

        params.data.quantity = newValue
        params.data.total_amount = newValue * params.data.unit_price
        
        const node = params.node
        if (node && node.rowIndex !== null && node.rowIndex !== undefined) {
          setRowData(prev => {
            const newData = [...prev]
            newData[node.rowIndex as number] = params.data
            return newData
          })
        }
        return true
      }
    },
    {
      headerName: '판매단가',
      field: 'unit_price',
      width: 120,
      editable: true,
      type: 'numericColumn',
      valueFormatter: params => params.value ? `₩${params.value.toLocaleString()}` : '',
      valueSetter: (params: ValueSetterParams<SaleRow>) => {
        const newValue = Number(params.newValue) || 0
        params.data.unit_price = newValue
        params.data.total_amount = params.data.quantity * newValue
        
        const node = params.node
        if (node && node.rowIndex !== null && node.rowIndex !== undefined) {
          setRowData(prev => {
            const newData = [...prev]
            newData[node.rowIndex as number] = params.data
            return newData
          })
        }
        return true
      }
    },
    {
      headerName: '판매금액',
      field: 'total_amount',
      width: 130,
      editable: false,
      type: 'numericColumn',
      valueFormatter: params => params.value ? `₩${params.value.toLocaleString()}` : '₩0',
      cellStyle: { fontWeight: 'bold', color: '#1e40af' } as CellStyle
    },
    {
      headerName: '삭제',
      width: 80,
      cellRenderer: DeleteButtonRenderer,
      cellRendererParams: { handleDeleteRow }
    }
  ], [products, handleProductSelect, handleDeleteRow])

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: false,
    filter: false
  }), [])

  // 행 추가
  const handleAddRow = () => {
    setRowData(prev => [...prev, {
      id: uuidv4(),
      product_code: '',
      product_name: '',
      specification: '',
      manufacturer: '',
      unit: '',
      quantity: 0,
      unit_price: 0,
      total_amount: 0,
      current_stock: 0
    }])
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <button
          onClick={handleAddRow}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + 행 추가
        </button>
      </div>

      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          domLayout="normal"
          suppressMovableColumns={true}
          animateRows={true}
          components={{
            productCellEditor: ProductCellEditor
          }}
        />
      </div>
    </div>
  )
}