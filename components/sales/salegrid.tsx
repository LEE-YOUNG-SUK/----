"use client"
/**
 * 판매 관리 그리드 (AG Grid)
 * 입고 그리드 VAT 계산 패턴 적용
 */
import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'

// (isGridDestroyedRef.current는 useRef로 컴포넌트 내부에서 관리)
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef } from 'ag-grid-community'
import type { ProductWithStock, SaleGridRow } from '@/types/sales'
import ProductSearchModal from '@/components/shared/ProductSearchModal'
import { KoreanInputCellEditor } from '@/components/shared/KoreanInputCellEditor'

const DeleteButtonRenderer = (props: any) => (
  <button
    onClick={() => props.handleDeleteRow(props.node.rowIndex)}
    className="w-full h-full text-red-600 hover:bg-red-50 transition"
  >
    🗑️
  </button>
)

interface Props {
  products: ProductWithStock[]
  onSave: (items: SaleGridRow[]) => void
  isSaving: boolean
  taxIncluded: boolean
  transactionType?: 'SALE' | 'USAGE'  // ✅ 추가
}

export default function SaleGrid({ products, onSave, isSaving, taxIncluded, transactionType = 'SALE' }: Props) {
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

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [modalSearchText, setModalSearchText] = useState('')
  const [nextInsertIndex, setNextInsertIndex] = useState<number>(0)
  
  const [rowData, setRowData] = useState<SaleGridRow[]>(() => {
    // 기본 10개 행 생성
    return Array.from({ length: 10 }, (_, index) => ({
      id: `temp_${Date.now()}_${index}`,
      product_id: null,
      product_code: '',
      product_name: '',
      category: '',
      unit: '',
      specification: '',
      current_stock: 0,
      quantity: 0,
      unit_price: 0,
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
      notes: ''
    }))
  })

  const addedProductIds = useMemo(() => {
    const ids = new Set<string>()
    rowData.forEach((row) => {
      if (row.product_id) ids.add(row.product_id)
    })
    return ids
  }, [rowData])

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
      current_stock: 0,
      quantity: 0,
      unit_price: 0,
      supply_price: 0,
      tax_amount: 0,
      total_price: 0,
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
    } else {
      const supply = qty * unit
      const tax = Math.round(supply * 0.1)
      const total = supply + tax
      row.supply_price = supply
      row.tax_amount = tax
      row.total_price = total
    }
  }

  // 부가세 구분 변경 시 전체 재계산
  useEffect(() => {
    if (!isMountedRef.current || isGridDestroyedRef.current) return
    setRowData(prev => prev.map(r => {
      const copy = { ...r }
      calculatePrices(copy, taxIncluded)
      return copy
    }))
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
          gridRef.current.api.refreshCells({ force: true })
        }
      } catch (e) {
        // 그리드 파괴 에러 무시
      }
    }, 0)
  }, [taxIncluded])

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData(prev => prev.filter((_, i) => i !== rowIndex))
  }, [])

  const openProductModal = useCallback((rowIndex: number, searchText: string = '') => {
    setNextInsertIndex(rowIndex)
    setModalSearchText(searchText)
    setIsProductModalOpen(true)
  }, [])

  const handleAddProduct = useCallback((product: ProductWithStock) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return

    setRowData(prev => {
      const newData = [...prev]
      let targetIndex = -1

      for (let i = nextInsertIndex; i < newData.length; i++) {
        if (!newData[i].product_id) {
          targetIndex = i
          break
        }
      }

      if (targetIndex === -1) {
        targetIndex = newData.length
        newData.push(createEmptyRow())
      }

      newData[targetIndex] = {
        ...newData[targetIndex],
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        current_stock: product.current_stock,
        unit_price: product.standard_sale_price || 0
      }
      calculatePrices(newData[targetIndex], taxIncluded)

      if (newData[newData.length - 1].product_id) {
        newData.push(createEmptyRow())
      }

      return newData
    })

    setNextInsertIndex(prev => prev + 1)

    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
          gridRef.current.api.refreshCells({ force: true })
        }
      } catch (e) {}
    }, 50)
  }, [nextInsertIndex, taxIncluded, createEmptyRow])

  const handleModalClose = useCallback(() => {
    setIsProductModalOpen(false)
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
          let targetRow = -1
          gridRef.current.api.forEachNode((node: any) => {
            if (targetRow === -1 && node.data?.product_id && node.data?.quantity === 0) {
              targetRow = node.rowIndex
            }
          })
          if (targetRow >= 0) {
            gridRef.current.api.startEditingCell({
              rowIndex: targetRow,
              colKey: 'quantity'
            })
          }
        }
      } catch (e) {}
    }, 100)
  }, [])

  // 행 인덱스 기반 직접 변경 → 정렬/필터 후 잘못된 행 갱신 가능성 있으므로 RowNode와 id를 기준으로 불변 업데이트
  const handleProductSelect = useCallback((rowNode: any, product: ProductWithStock) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
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
        current_stock: product.current_stock,
        unit_price: product.standard_sale_price || 0
      }
      calculatePrices(updated, taxIncluded)
      return updated
    }))
    // 선택한 행만 강제 리프레시 (rowNode 그대로 사용)
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api && rowNode?.data) {
          gridRef.current.api.refreshCells({
            force: true,
            rowNodes: [rowNode],
            columns: ['product_code','product_name','unit','unit_price','supply_price','tax_amount','total_price']
          })
        }
      } catch (e) {
        // 페이지 새로고침 중 Grid가 파괴되어 발생하는 에러 무시
      }
    }, 0)
  }, [taxIncluded])

  function resolveNextEditableColumn(api: any, currentCol: any, backwards = false) {
    const allCols = api.getAllDisplayedColumns()
    const curIdx = allCols.indexOf(currentCol)
    const dir = backwards ? -1 : 1
    for (let i = curIdx + dir; i >= 0 && i < allCols.length; i += dir) {
      const colDef = allCols[i].getColDef()
      if (colDef.field === 'product_code' || colDef.field === 'product_name') continue
      if (colDef.editable) return allCols[i]
    }
    return null
  }

  const moveEditingCellByArrow = useCallback((params: any, key: string) => {
    const currentRowIndex = params.node.rowIndex ?? 0
    const displayedRowCount = params.api.getDisplayedRowCount()
    let nextRowIndex = currentRowIndex
    let nextColumn = params.column

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const adjacentColumn = resolveNextEditableColumn(params.api, params.column, key === 'ArrowLeft')
      if (!adjacentColumn) return true
      nextColumn = adjacentColumn
    } else if (key === 'ArrowUp') {
      if (currentRowIndex <= 0) return true
      nextRowIndex = currentRowIndex - 1
    } else if (key === 'ArrowDown') {
      nextRowIndex = currentRowIndex + 1
      if (nextRowIndex >= displayedRowCount) {
        setRowData((prev) => [...prev, createEmptyRow()])
      }
    } else {
      return false
    }

    params.event.preventDefault()
    params.event.stopPropagation()
    params.api.stopEditing()

    setTimeout(() => {
      try {
        if (!isMountedRef.current || isGridDestroyedRef.current || !gridRef.current?.api) return
        gridRef.current.api.ensureIndexVisible(nextRowIndex)
        gridRef.current.api.startEditingCell({
          rowIndex: nextRowIndex,
          colKey: nextColumn.getColId()
        })
      } catch (e) {}
    }, 50)

    return true
  }, [createEmptyRow])

  const suppressArrowNavigation = useCallback((params: any) => {
    if (!params.editing) return false
    if (params.event.isComposing) return false

    const key = params.event.key
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      return false
    }

    return moveEditingCellByArrow(params, key)
  }, [moveEditingCellByArrow])

  const columnDefs = useMemo<ColDef<SaleGridRow>[]>(() => {
    // ✅ 추가: 단가 컬럼 정의 (거래유형별 다름)
    const unitPriceColumn: ColDef<SaleGridRow> = transactionType === 'USAGE' 
      ? {
          headerName: '출고단가 (자동)',
          field: 'unit_price',
          width: 140,
          editable: false,
          type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
          cellClass: 'bg-purple-50 text-right font-medium text-purple-700',
          valueFormatter: (params) => {
            const value = params.value || 0
            return `₩${value.toLocaleString()}`
          },
          headerTooltip: 'FIFO 평균 원가로 자동 계산됩니다'
        }
      : {
          headerName: '판매단가',
          field: 'unit_price',
          width: 110,
          minWidth: 110,
          editable: true,
          type: 'numericColumn',
          suppressKeyboardEvent: suppressArrowNavigation,
      headerClass: 'ag-header-cell-center',
          cellClass: 'text-right',
          valueFormatter: (params) => {
            const value = params.value || 0
            return `₩${value.toLocaleString()}`
          }
        }

    return [
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
      cellEditor: KoreanInputCellEditor,
      suppressKeyboardEvent: (params) => {
        if (!params.editing) return false
        if (params.event.key === 'Enter') {
          if (params.event.isComposing) return false
          const searchText = (params.event.target as HTMLInputElement).value || ''
          params.api.stopEditing()
          setTimeout(() => {
            openProductModal(params.node.rowIndex ?? 0, searchText)
          }, 0)
          return true
        }
        return false
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
      cellEditor: KoreanInputCellEditor,
      suppressKeyboardEvent: (params) => {
        if (!params.editing) return false
        if (params.event.key === 'Enter') {
          if (params.event.isComposing) return false
          const searchText = (params.event.target as HTMLInputElement).value || ''
          params.api.stopEditing()
          setTimeout(() => {
            openProductModal(params.node.rowIndex ?? 0, searchText)
          }, 0)
          return true
        }
        return false
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
      suppressKeyboardEvent: suppressArrowNavigation,
      headerClass: 'ag-header-cell-center',
      cellClass: 'text-center',
      valueFormatter: (params) => {
        const value = params.value || 0
        return value.toLocaleString()
      }
    },
    unitPriceColumn,  // ✅ 변경: 조건부 컬럼
    {
      headerName: '공급가',
      field: 'supply_price',
      width: 130,
      minWidth: 130,
      editable: false,
      type: 'numericColumn',
      headerClass: 'ag-header-cell-center',
      cellClass: 'bg-gray-50 text-right font-medium',
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
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
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
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
      valueFormatter: p => `₩${(p.value || 0).toLocaleString()}`
    },
    {
      headerName: '비고',
      field: 'notes',
      width: 130,
      minWidth: 130,
      editable: true,
      suppressKeyboardEvent: suppressArrowNavigation,
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
  ]}, [handleDeleteRow, openProductModal, suppressArrowNavigation, transactionType])

  const onCellValueChanged = useCallback((params: any) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const { data } = params
    const updated = { ...data }
    calculatePrices(updated, taxIncluded)
    setRowData(prev => {
      if (!isMountedRef.current) return prev  // ✅ 추가 체크
      return prev.map(r => r.id === updated.id ? updated : r)
    })
    try {
      if (!isGridDestroyedRef.current && isMountedRef.current && params.api && params.node) {
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['supply_price','tax_amount','total_price']
        })
      }
    } catch (e) {
      // 페이지 새로고침 중 Grid가 파괴되어 발생하는 에러 무시
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
      const colDef = allCols[i].getColDef()
      if (colDef.field === 'product_code' || colDef.field === 'product_name') continue
      if (colDef.editable) return allCols[i]
    }
    return null
  }, [])

  // Tab: 편집 불가 셀 건너뛰기
  const tabToNextCell = useCallback((params: any) => {
    const nextCol = resolveNextEditableColumn(params.api, params.previousCellPosition.column, params.backwards)
    if (nextCol) {
      return {
        rowIndex: params.previousCellPosition.rowIndex,
        column: nextCol,
        floating: params.previousCellPosition.floating
      }
    }
    return params.nextCellPosition
  }, [])

  // Enter / Right Arrow: 다음 편집 가능 셀로 이동
  const onCellKeyDown = useCallback((params: any) => {
    const key = params.event.key
    if (key !== 'Enter' && key !== 'ArrowRight') return
    const col = params.column
    const field = col.getColDef().field
    // 품목코드/품목명은 자체 키보드 처리 사용
    if (field === 'product_code' || field === 'product_name') return

    const nextCol = resolveNextEditableColumn(params.api, col)
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
  }, [createEmptyRow])


  const handleSave = useCallback(() => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return  // ✅ 파괴 상태 체크
    const api = gridRef.current?.api
    if (!api) return

    const data: SaleGridRow[] = []
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
      alert(`${transactionType === 'USAGE' ? '사용할' : '판매할'} 품목을 입력해주세요.`)
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
      // ✅ 판매(SALE)일 때만 단가 검증 (사용(USAGE)은 서버에서 자동 계산, 0원 허용)
      if (transactionType === 'SALE' && item.unit_price < 0) {
        errors.push(`${index + 1}번째 행: 단가는 0 이상이어야 합니다.`)
      }
      // ✅ 재고 부족 체크 제거 - 마이너스 재고 허용
      // if (item.quantity > item.current_stock) {
      //   errors.push(`${index + 1}번째 행: 재고가 부족합니다. (재고: ${item.current_stock})`)
      // }
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
          onCellValueChanged={onCellValueChanged}
          onCellEditingStarted={onCellEditingStarted}
          onCellKeyDown={onCellKeyDown}
          tabToNextCell={tabToNextCell}
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={true}
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

      <ProductSearchModal
        isOpen={isProductModalOpen}
        onClose={handleModalClose}
        onAdd={handleAddProduct}
        products={products}
        initialSearch={modalSearchText}
        addedProductIds={addedProductIds}
      />
    </div>
  )
}
