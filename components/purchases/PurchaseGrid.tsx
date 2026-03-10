'use client'

/**
 * 입고 관리 그리드 (AG Grid)
 * 품목 선택: 셀에 검색어 입력 → Enter → 모달에서 선택
 */

import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef } from 'ag-grid-community'
import type { Product } from '@/types'
import type { PurchaseGridRow } from '@/types/purchases'
import ProductSearchModal from '@/components/shared/ProductSearchModal'
import { KoreanInputCellEditor } from '@/components/shared/KoreanInputCellEditor'

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
  taxIncluded: boolean
}

export default function PurchaseGrid({ products, onSave, isSaving, taxIncluded }: Props) {
  const gridRef = useRef<any>(null)
  const isMountedRef = useRef(true)
  const isGridDestroyedRef = useRef(false)

  useEffect(() => {
    isGridDestroyedRef.current = false
    isMountedRef.current = true
    return () => {
      isGridDestroyedRef.current = true
      isMountedRef.current = false
    }
  }, [])

  // 품목 검색 모달 상태
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [modalSearchText, setModalSearchText] = useState('')
  const [nextInsertIndex, setNextInsertIndex] = useState<number>(0)

  const [rowData, setRowData] = useState<PurchaseGridRow[]>(() => {
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

  // 이미 그리드에 추가된 품목 ID 추적
  const addedProductIds = useMemo(() => {
    const ids = new Set<string>()
    rowData.forEach(r => { if (r.product_id) ids.add(r.product_id) })
    return ids
  }, [rowData])

  function calculatePrices(row: PurchaseGridRow, isTaxIncluded: boolean) {
    const quantity = row.quantity || 0
    const unitCost = row.unit_cost || 0

    if (isTaxIncluded) {
      const totalPrice = quantity * unitCost
      const supplyPrice = Math.round(totalPrice / 1.1)
      const taxAmount = totalPrice - supplyPrice
      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_price = totalPrice
    } else {
      const supplyPrice = quantity * unitCost
      const taxAmount = Math.round(supplyPrice * 0.1)
      const totalPrice = supplyPrice + taxAmount
      row.supply_price = supplyPrice
      row.tax_amount = taxAmount
      row.total_price = totalPrice
    }
  }

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
    if (!isMountedRef.current || isGridDestroyedRef.current) return
    if (rowData.length > 0) {
      const updatedData = rowData.map(row => {
        const updatedRow = { ...row }
        calculatePrices(updatedRow, taxIncluded)
        return updatedRow
      })
      setRowData(updatedData)
      setTimeout(() => {
        try {
          if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
            gridRef.current.api.refreshCells({ force: true })
          }
        } catch (e) {}
      }, 0)
    }
  }, [taxIncluded])

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setRowData((prev) => prev.filter((_, index) => index !== rowIndex))
  }, [])

  // 모달 열기 (검색어 포함)
  const openProductModal = useCallback((rowIndex: number, searchText: string = '') => {
    setNextInsertIndex(rowIndex)
    setModalSearchText(searchText)
    setIsProductModalOpen(true)
  }, [])

  // 모달에서 품목 1개 즉시 추가 (체크박스/행 클릭)
  const handleAddProduct = useCallback((product: Product) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return

    setRowData(prev => {
      const newData = [...prev]

      // 빈 행 찾기 (nextInsertIndex부터)
      let targetIndex = -1
      for (let i = nextInsertIndex; i < newData.length; i++) {
        if (!newData[i].product_id) {
          targetIndex = i
          break
        }
      }

      // 빈 행이 없으면 새로 추가
      if (targetIndex === -1) {
        targetIndex = newData.length
        newData.push(createEmptyRow())
      }

      // 품목 정보 채우기
      newData[targetIndex] = {
        ...newData[targetIndex],
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        category: product.category || '',
        unit: product.unit,
        specification: product.specification || '',
        unit_cost: product.standard_purchase_price || 0
      }
      calculatePrices(newData[targetIndex], taxIncluded)

      // 마지막 행 뒤에 빈 행 보장
      const lastIndex = newData.length - 1
      if (newData[lastIndex].product_id) {
        newData.push(createEmptyRow())
      }

      return newData
    })

    // 다음 삽입 위치 업데이트
    setNextInsertIndex(prev => prev + 1)

    // 그리드 새로고침
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
          gridRef.current.api.refreshCells({ force: true })
        }
      } catch (e) {}
    }, 50)
  }, [nextInsertIndex, taxIncluded, createEmptyRow])

  // 모달 닫힌 후 첫 번째 추가 행의 수량 셀로 이동
  const handleModalClose = useCallback(() => {
    setIsProductModalOpen(false)
    setTimeout(() => {
      try {
        if (!isGridDestroyedRef.current && isMountedRef.current && gridRef.current?.api) {
          // 수량이 0인 첫 번째 품목 행 찾기 (수량 입력이 필요한 행)
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
      cellEditor: KoreanInputCellEditor,
      suppressKeyboardEvent: (params) => {
        if (!params.editing) return false
        if (params.event.key === 'Enter') {
          if (params.event.isComposing) return false
          // stopEditing 전에 DOM input에서 직접 값을 캡처 (React 상태 클로저 문제 방지)
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
          // stopEditing 전에 DOM input에서 직접 값을 캡처
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
    {
      headerName: '단가',
      field: 'unit_cost',
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
  ], [handleDeleteRow, openProductModal, suppressArrowNavigation])

  const onCellValueChanged = useCallback((params: any) => {
    if (isGridDestroyedRef.current || !isMountedRef.current) return
    const { data } = params
    const updated = { ...data }
    calculatePrices(updated, taxIncluded)
    setRowData(prev => {
      if (!isMountedRef.current) return prev
      return prev.map(r => r.id === updated.id ? updated : r)
    })
    try {
      if (!isGridDestroyedRef.current && isMountedRef.current && params.api && params.node) {
        params.api.refreshCells({
          rowNodes: [params.node],
          columns: ['supply_price', 'tax_amount', 'total_price']
        })
      }
    } catch (e) {}
  }, [taxIncluded])

  // 마지막 행 편집 시 자동으로 새 행 추가
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

  // 다음 편집 가능 셀 찾기
  const _findNextEditableColumnUnused = useCallback((api: any, currentCol: any, backwards = false) => {
    const allCols = api.getAllDisplayedColumns()
    const curIdx = allCols.indexOf(currentCol)
    const dir = backwards ? -1 : 1
    for (let i = curIdx + dir; i >= 0 && i < allCols.length; i += dir) {
      const colDef = allCols[i].getColDef()
      // 품목코드/품목명은 건너뜀 (모달로만 입력)
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
    const col = params.column
    const field = col.getColDef().field

    // 품목코드/품목명은 suppressKeyboardEvent에서 처리
    if (field === 'product_code' || field === 'product_name') return

    if (key !== 'Enter' && key !== 'ArrowRight') return

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
      // 마지막 편집 셀(비고)에서 Enter → 다음 행 품목코드 편집 시작
      const nextRowIndex = params.node.rowIndex + 1
      params.event.preventDefault()
      params.event.stopPropagation()
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
    if (isGridDestroyedRef.current || !isMountedRef.current) return
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
            <span className="hidden sm:inline">품목코드/품목명에 검색어 입력 후 <strong>Enter</strong> → 모달에서 <strong>체크</strong>(다중 추가) 또는 <strong>클릭</strong>(단일 추가)</span>
            <span className="sm:hidden">품목코드 입력 → <strong>Enter</strong> → 모달에서 선택</span>
          </div>
        </div>
      </div>

      {/* 품목 검색 모달 */}
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
