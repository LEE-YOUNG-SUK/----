'use client'

/**
 * 입고 관리 그리드 (AG Grid)
 * 품목 자동완성 통합 버전
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'

// (isGridDestroyedRef.current는 useRef로 컴포넌트 내부에서 관리)
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
      🗑️
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
  const isGridDestroyedRef = useRef(false)  // ✅ 인스턴스별 그리드 파괴 상태

  // ✅ 컴포넌트 마운트/언마운트 시 플래그 설정
  useEffect(() => {
    isGridDestroyedRef.current = false
    isMountedRef.current = true
    return () => {
      isGridDestroyedRef.current = true
      isMountedRef.current = false
    }
  }, [])
  
  const [rowData, setRowData] = useState<PurchaseGridRow[]>(() => {
    // 기본 10개 행 생성
    return Array.from({ length: 10 }, (_, index) => ({
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
      specification: '',
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
    const unitCost = row.unit_cost || 0

    if (isTaxIncluded) {
      // 부가세 포함: 수량 * 단가 = 합계
      const totalPrice = quantity * unitCost
      const supplyPrice = Math.round(totalPrice / 1.1)
      const taxAmount = totalPrice - supplyPrice

      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_price = totalPrice
    } else {
      // 부가세 미포함: 수량 * 단가 = 공급가
      const supplyPrice = quantity * unitCost
      const taxAmount = Math.round(supplyPrice * 0.1)
      const totalPrice = supplyPrice + taxAmount

      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_price = totalPrice
    }
    // unit_cost는 사용자 입력값 그대로 유지
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
      specification: '',
      notes: ''
    })
  }, [])

  // 부가세 구분 변경 시 전체 행 재계산
  useEffect(() => {
    if (!isMountedRef.current || isGridDestroyedRef.current) return  // ✅ 파괴 상태 체크
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
          if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
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
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
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
        unit_cost: product.standard_purchase_price || 0  // ✅ 표준 입고 단가 설정
      }
      
      // 자동계산 적용
      calculatePrices(updated, taxIncluded)
      return updated
    }))
    
    // 선택한 행만 강제 리프레시
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api && rowNode) {
          gridRef.current.api.refreshCells({
            force: true,
            rowNodes: [rowNode],
            columns: ['product_code', 'product_name', 'unit', 'specification', 'supply_price', 'tax_amount', 'total_price']
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
      minWidth: 60,
      pinned: 'left',
      cellClass: 'text-center font-medium text-gray-900'
    },
    {
      headerName: '품목코드',
      field: 'product_code',
      width: 110,
      pinned: 'left',
      editable: true,
      cellEditor: ProductCellEditor,
      cellEditorParams: (params: ICellEditorParams) => ({
        products: products,
        onProductSelect: (product: Product) => {
          handleProductSelect(params.node, product)
        },
        stopEditing: () => params.api.stopEditing(),
        navigateToQuantity: () => {
          params.api.startEditingCell({
            rowIndex: params.node.rowIndex!,
            colKey: 'quantity'
          })
        }
      }),
      suppressKeyboardEvent: (params) => {
        if (!params.editing) return false
        const key = params.event.key
        return key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp'
      },
      cellClass: 'text-center font-medium text-blue-600'
    },
    {
      headerName: '품목명',
      field: 'product_name',
      width: 200,
      minWidth: 200,
      pinned: 'left',
      editable: true,
      cellEditor: ProductCellEditor,
      cellEditorParams: (params: ICellEditorParams) => ({
        products: products,
        onProductSelect: (product: Product) => {
          handleProductSelect(params.node, product)
        },
        stopEditing: () => params.api.stopEditing(),
        navigateToQuantity: () => {
          params.api.startEditingCell({
            rowIndex: params.node.rowIndex!,
            colKey: 'quantity'
          })
        }
      }),
      suppressKeyboardEvent: (params) => {
        if (!params.editing) return false
        const key = params.event.key
        return key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp'
      },
      cellClass: 'text-center'
    },
    {
      headerName: '규격',
      field: 'specification',
      width: 130,
      minWidth: 130,
      editable: false,
      cellClass: 'text-center bg-gray-50 text-sm'
    },
    {
      headerName: '단위',
      field: 'unit',
      width: 80,
      minWidth: 80,
      editable: false,
      cellClass: 'text-center bg-gray-50 font-medium'
    },
    {
      headerName: '수량',
      field: 'quantity',
      width: 80,
      minWidth: 80,
      editable: true,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: 'text-center',
      valueFormatter: (params) => {
        const value = params.value || 0
        return value.toLocaleString()
      }
    },
    {
      headerName: '단가',
      field: 'unit_cost',
      width: 110,
      minWidth: 110,
      editable: true,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
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
      minWidth: 130,
      editable: false,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
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
      minWidth: 120,
      editable: false,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: 'bg-gray-50 text-right font-medium text-orange-600',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '합계',
      field: 'total_price',
      width: 130,
      minWidth: 130,
      editable: false,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: 'bg-blue-50 text-right font-bold text-blue-700',
      valueFormatter: (params) => {
        const value = params.value || 0
        return `₩${value.toLocaleString()}`
      }
    },
    {
      headerName: '비고',
      field: 'notes',
      width: 130,
      minWidth: 130,
      editable: true,
      cellClass: 'text-center text-sm'
    },
    {
      headerName: '삭제',
      width: 60,
      minWidth: 60,
      cellRenderer: DeleteButtonRenderer,
      cellRendererParams: {
        handleDeleteRow: handleDeleteRow
      }
    }
  ], [handleDeleteRow, handleProductSelect, products])

  const onCellValueChanged = useCallback((params: any) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const { data } = params
    const updated = { ...data }

    // 자동계산 적용 (불변 복사본에 적용)
    calculatePrices(updated, taxIncluded)

    // rowData 상태 업데이트 (id 기반 불변 업데이트)
    setRowData(prev => {
      if (!isMountedRef.current) return prev  // ✅ 추가 체크
      return prev.map(r => r.id === updated.id ? updated : r)
    })
    
    // 계산된 필드들 새로고침
    try {
      if (!isGridDestroyedRef.current && isMountedRef.current && params.api && params.node) {
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['supply_price', 'tax_amount', 'total_price']
        })
      }
    } catch (e) {
      // 그리드 파괴 에러 무시
    }
  }, [taxIncluded])

  // 마지막 행 편집 시 자동으로 새 행 추가 + 편집 모드 복원
  const onCellEditingStarted = useCallback((params: any) => {
    const rowIndex = params.rowIndex
    const colKey = params.column.getColId()
    const totalRows = params.api.getDisplayedRowCount()
    if (rowIndex === totalRows - 1) {
      setRowData((prev) => [...prev, createEmptyRow()])
      setTimeout(() => {
        try {
          if (gridRef.current?.api) {
            gridRef.current.api.startEditingCell({ rowIndex, colKey })
          }
        } catch (e) {}
      }, 50)
    }
  }, [createEmptyRow])

  // 다음 편집 가능 셀 찾기 (공통 유틸)
  const findNextEditableColumn = useCallback((api: any, currentCol: any, backwards = false) => {
    const allCols = api.getAllDisplayedColumns()
    const curIdx = allCols.indexOf(currentCol)
    const dir = backwards ? -1 : 1
    for (let i = curIdx + dir; i >= 0 && i < allCols.length; i += dir) {
      if (allCols[i].getColDef().editable) return allCols[i]
    }
    return null
  }, [])

  // Tab: 편집 불가 셀 건너뛰기
  const tabToNextCell = useCallback((params: any) => {
    const nextCol = findNextEditableColumn(params.api, params.previousCellPosition.column, params.backwards)
    if (nextCol) {
      return {
        rowIndex: params.previousCellPosition.rowIndex,
        column: nextCol,
        floating: params.previousCellPosition.floating
      }
    }
    return params.nextCellPosition
  }, [findNextEditableColumn])

  // Enter / Right Arrow: 다음 편집 가능 셀로 이동
  const onCellKeyDown = useCallback((params: any) => {
    const key = params.event.key
    if (key !== 'Enter' && key !== 'ArrowRight') return
    const col = params.column
    const field = col.getColDef().field
    // 품목코드/품목명은 자체 키보드 처리 사용
    if (field === 'product_code' || field === 'product_name') return

    const nextCol = findNextEditableColumn(params.api, col)
    if (nextCol) {
      params.event.preventDefault()
      params.event.stopPropagation()
      setTimeout(() => {
        params.api.startEditingCell({
          rowIndex: params.node.rowIndex,
          colKey: nextCol.getColId()
        })
      }, 50)
    } else if (key === 'Enter') {
      // 마지막 편집 셀(비고)에서 Enter → 다음 행 품목코드로 이동
      const nextRowIndex = params.node.rowIndex + 1
      params.event.preventDefault()
      params.event.stopPropagation()
      // 다음 행이 없으면 자동 생성
      if (nextRowIndex >= params.api.getDisplayedRowCount()) {
        setRowData((prev) => [...prev, createEmptyRow()])
      }
      setTimeout(() => {
        params.api.startEditingCell({
          rowIndex: nextRowIndex,
          colKey: 'product_code'
        })
      }, 50)
    }
  }, [findNextEditableColumn, createEmptyRow])


  const handleSave = useCallback(() => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
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
      if (item.unit_cost < 0) {
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
        <div className="flex items-center gap-6 ml-auto">
          <div className="text-sm">
            <span className="text-gray-900">입력 품목:</span>
            <span className="ml-2 font-bold text-lg text-blue-600">
              {validRowCount}
            </span>
            <span className="text-gray-900 ml-1">개</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-900">합계 금액:</span>
            <span className="ml-2 font-bold text-lg text-red-600">
              ₩{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
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
            minWidth: 100,
            headerClass: 'ag-header-cell-center',
            cellClass: 'text-center'
          }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          suppressMovableColumns={true}
          rowHeight={40}
          headerHeight={45}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStarted={onCellEditingStarted}
          onCellKeyDown={onCellKeyDown}
          tabToNextCell={tabToNextCell}
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