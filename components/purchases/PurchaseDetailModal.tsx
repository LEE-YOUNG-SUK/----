'use client'

/**
 * 거래번호별 입고 상세 모달
 * AG Grid 기반 즉시 편집 + 일괄 저장 (입력 그리드 UX 동일)
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/hooks/useConfirm'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColDef } from 'ag-grid-community'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ProductCellEditor } from './ProductCellEditor'
import { updatePurchase, deletePurchase, addPurchaseItem } from '@/app/purchases/actions'
import { usePermissions } from '@/hooks/usePermissions'
import type { PurchaseHistory } from '@/types/purchases'
import type { Product } from '@/types'

// 그리드 행 타입
interface DetailRow {
  _rowId: string
  _isNew: boolean
  // DB 필드
  id: string
  product_id: string
  product_code: string
  product_name: string
  specification: string
  unit: string
  quantity: number
  unit_cost: number
  supply_price: number
  tax_amount: number
  total_price: number
  notes: string
}

interface Props {
  referenceNumber: string
  items: PurchaseHistory[]
  products: Product[]
  onClose: () => void
  userRole: string
  userId: string
  userBranchId: string
  readOnly?: boolean
}

const MIN_ROWS = 10

export default function PurchaseDetailModal({
  referenceNumber,
  items,
  products,
  onClose,
  userRole,
  userId,
  userBranchId,
  readOnly = false
}: Props) {
  const router = useRouter()
  const gridRef = useRef<AgGridReact>(null)
  const { can } = usePermissions(userRole)
  const canEdit = can('purchases_management', 'update')
  const [isSaving, setIsSaving] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const { confirm, ConfirmDialogComponent } = useConfirm()

  // 빈 행 생성
  const createEmptyRow = useCallback((): DetailRow => ({
    _rowId: `new_${Date.now()}_${Math.random()}`,
    _isNew: true,
    id: '',
    product_id: '',
    product_code: '',
    product_name: '',
    specification: '',
    unit: '',
    quantity: 0,
    unit_cost: 0,
    supply_price: 0,
    tax_amount: 0,
    total_price: 0,
    notes: ''
  }), [])

  // items → DetailRow 변환 + 빈 행으로 최소 10행 채우기
  const buildInitialRows = useCallback((): DetailRow[] => {
    const dataRows: DetailRow[] = items.map((item) => {
      const product = products.find(p => p.id === item.product_id)
      return {
        _rowId: item.id,
        _isNew: false,
        id: item.id,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        specification: product?.specification || '',
        unit: item.unit,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        supply_price: item.supply_price || 0,
        tax_amount: item.tax_amount || 0,
        total_price: item.total_price,
        notes: item.notes || ''
      }
    })
    if (readOnly) return dataRows
    const emptyCount = Math.max(0, MIN_ROWS - dataRows.length)
    const emptyRows = Array.from({ length: emptyCount }, () => createEmptyRow())
    return [...dataRows, ...emptyRows]
  }, [items, products, createEmptyRow, readOnly])

  const [rowData, setRowData] = useState<DetailRow[]>(buildInitialRows)

  // 총액 계산 (품목이 있는 행만)
  const validRows = rowData.filter(r => r.product_id)
  const totalAmount = validRows.reduce((sum, r) => sum + (r.total_price || 0), 0)
  const totalSupply = validRows.reduce((sum, r) => sum + (r.supply_price || 0), 0)
  const totalTax = validRows.reduce((sum, r) => sum + (r.tax_amount || 0), 0)
  const validRowCount = validRows.length

  // 부가세 포함 여부 판단: 기존 데이터의 비율로 추론
  const [taxIncluded, setTaxIncluded] = useState(() => {
    const first = items[0]
    if (!first || !first.supply_price || !first.total_price) return true
    // supply_price ≈ total_price / 1.1 이면 부가세 포함
    const ratio = first.supply_price / first.total_price
    return ratio < 0.95 // 공급가가 합계의 95% 미만이면 부가세 포함
  })

  // 가격 자동 계산 (부가세 포함/미포함 분기)
  function calculatePrices(row: DetailRow) {
    const quantity = row.quantity || 0
    const unitCost = row.unit_cost || 0
    if (taxIncluded) {
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

  // 품목 선택 핸들러
  const handleProductSelect = useCallback((rowNode: any, product: Product) => {
    const targetId = rowNode?.data?._rowId
    if (!targetId) return

    setRowData(prev => prev.map(r => {
      if (r._rowId !== targetId) return r
      const updated = {
        ...r,
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        specification: product.specification || '',
        unit: product.unit,
        unit_cost: product.standard_purchase_price || 0
      }
      calculatePrices(updated)
      return updated
    }))

    setTimeout(() => {
      if (gridRef.current?.api && rowNode) {
        gridRef.current.api.refreshCells({
          force: true,
          rowNodes: [rowNode],
          columns: ['product_code', 'product_name', 'specification', 'unit', 'supply_price', 'tax_amount', 'total_price']
        })
      }
    }, 0)
  }, [])

  // 셀 값 변경 시 자동 계산
  const onCellValueChanged = useCallback((params: any) => {
    const { data } = params
    const field = params.column.getColId()

    if (field === 'quantity' || field === 'unit_cost') {
      calculatePrices(data)
      setRowData(prev => prev.map(r => r._rowId === data._rowId ? { ...data } : r))
      params.api.refreshCells({
        rowNodes: [params.node],
        columns: ['supply_price', 'tax_amount', 'total_price']
      })
    } else {
      setRowData(prev => prev.map(r => r._rowId === data._rowId ? { ...data } : r))
    }
  }, [])

  // 마지막 행 편집 시 자동으로 새 행 추가
  const onCellEditingStarted = useCallback((params: any) => {
    const rowIndex = params.rowIndex
    const colKey = params.column.getColId()
    const totalRows = params.api.getDisplayedRowCount()
    if (rowIndex === totalRows - 1) {
      setRowData(prev => [...prev, createEmptyRow()])
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
  const findNextEditableColumn = useCallback((api: any, currentCol: any, backwards = false) => {
    const allCols = api.getAllDisplayedColumns()
    const curIdx = allCols.indexOf(currentCol)
    const dir = backwards ? -1 : 1
    for (let i = curIdx + dir; i >= 0 && i < allCols.length; i += dir) {
      const colDef = allCols[i].getColDef()
      if (colDef.editable === true || typeof colDef.editable === 'function') return allCols[i]
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
      const nextRowIndex = params.node.rowIndex + 1
      params.event.preventDefault()
      params.event.stopPropagation()
      if (nextRowIndex >= params.api.getDisplayedRowCount()) {
        setRowData(prev => [...prev, createEmptyRow()])
      }
      setTimeout(() => {
        params.api.startEditingCell({
          rowIndex: nextRowIndex,
          colKey: 'product_code'
        })
      }, 50)
    }
  }, [findNextEditableColumn, createEmptyRow])

  // 행 삭제 핸들러 (일괄 저장 시 함께 처리)
  const handleDeleteRow = useCallback(async (rowIndex: number) => {
    const row = rowData[rowIndex]
    if (!row) return

    // 빈 행이면 그냥 제거
    if (!row.product_id) {
      setRowData(prev => prev.filter((_, i) => i !== rowIndex))
      return
    }

    // 기존 DB 행이면 확인 후 삭제 예정에 추가
    if (!row._isNew) {
      const ok = await confirm({ title: '삭제 확인', message: `입고 데이터를 삭제하시겠습니까?\n\n품목: ${row.product_name}\n수량: ${row.quantity} ${row.unit}\n\n일괄 저장 시 삭제가 적용됩니다.`, variant: 'danger' })
      if (!ok) return
      setDeletedIds(prev => new Set(prev).add(row.id))
    }

    setRowData(prev => prev.filter((_, i) => i !== rowIndex))
  }, [rowData])

  // 일괄 저장 핸들러
  const handleBulkSave = useCallback(async () => {
    // 변경된 행 수집
    const toUpdate: DetailRow[] = []
    const toAdd: DetailRow[] = []
    const toDelete = Array.from(deletedIds)

    rowData.forEach(row => {
      if (!row.product_id) return // 빈 행 무시

      if (row._isNew) {
        if (row.quantity > 0) toAdd.push(row)
      } else {
        // 기존 행: 원본과 비교하여 변경 감지
        const original = items.find(item => item.id === row.id)
        if (!original) return
        if (
          row.quantity !== original.quantity ||
          row.unit_cost !== original.unit_cost ||
          row.notes !== (original.notes || '')
        ) {
          toUpdate.push(row)
        }
      }
    })

    if (toUpdate.length === 0 && toAdd.length === 0 && toDelete.length === 0) {
      alert('변경된 내용이 없습니다.')
      return
    }

    // 유효성 검사
    const errors: string[] = []
    ;[...toUpdate, ...toAdd].forEach((row) => {
      if (row.quantity <= 0) errors.push(`${row.product_name}: 수량은 0보다 커야 합니다.`)
    })
    if (errors.length > 0) {
      alert(errors.join('\n'))
      return
    }

    setIsSaving(true)
    const results: string[] = []
    let hasError = false

    // 삭제 처리
    for (const id of toDelete) {
      const result = await deletePurchase({ purchase_id: id })
      if (!result.success) {
        const item = items.find(i => i.id === id)
        results.push(`삭제 실패: ${item?.product_name || id} - ${result.message}`)
        hasError = true
      }
    }

    // 기존 행 수정
    for (const row of toUpdate) {
      const result = await updatePurchase({
        purchase_id: row.id,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        supply_price: row.supply_price,
        tax_amount: row.tax_amount,
        total_price: row.total_price,
        notes: row.notes
      })
      if (!result.success) {
        results.push(`수정 실패: ${row.product_name} - ${result.message}`)
        hasError = true
      }
    }

    // 새 품목 추가
    for (const row of toAdd) {
      const firstItem = items[0]
      if (!firstItem) {
        results.push('추가 실패: 기존 거래 정보가 없습니다.')
        hasError = true
        continue
      }
      const result = await addPurchaseItem({
        reference_number: referenceNumber,
        branch_id: firstItem.branch_id,
        product_id: row.product_id,
        client_id: firstItem.client_id,
        purchase_date: firstItem.purchase_date,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        supply_price: row.supply_price,
        tax_amount: row.tax_amount,
        total_price: row.total_price,
        notes: row.notes
      })
      if (!result.success) {
        results.push(`추가 실패: ${row.product_name} - ${result.message}`)
        hasError = true
      }
    }

    setIsSaving(false)

    if (hasError) {
      alert(results.join('\n'))
    } else {
      const parts: string[] = []
      if (toDelete.length > 0) parts.push(`삭제: ${toDelete.length}건`)
      if (toUpdate.length > 0) parts.push(`수정: ${toUpdate.length}건`)
      if (toAdd.length > 0) parts.push(`추가: ${toAdd.length}건`)
      alert(`저장 완료 (${parts.join(', ')})`)
      onClose()
      router.refresh()
    }
  }, [rowData, items, deletedIds, referenceNumber, onClose, router])

  // 삭제 버튼 렌더러
  const DeleteButtonRenderer = useCallback((props: any) => {
    return (
      <button
        onClick={() => handleDeleteRow(props.node.rowIndex)}
        className="w-full h-full text-red-600 hover:bg-red-50 transition"
      >
        🗑️
      </button>
    )
  }, [handleDeleteRow])

  // 컬럼 정의 (입력 그리드와 동일)
  const columnDefs = useMemo<ColDef<DetailRow>[]>(() => {
    const cols: ColDef<DetailRow>[] = [
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
        editable: readOnly ? false : (params) => !params.data?.product_id || !!params.data?._isNew,
        ...(!readOnly && {
          cellEditor: ProductCellEditor,
          cellEditorParams: (params: any) => ({
            products,
            onProductSelect: (product: Product) => handleProductSelect(params.node, product),
            stopEditing: () => params.api.stopEditing(),
            navigateToQuantity: () => {
              params.api.startEditingCell({
                rowIndex: params.node.rowIndex!,
                colKey: 'quantity'
              })
            }
          }),
          suppressKeyboardEvent: (params: any) => {
            if (!params.editing) return false
            const key = params.event.key
            return key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp'
          },
        }),
        cellClass: 'text-center font-medium text-blue-600'
      },
      {
        headerName: '품목명',
        field: 'product_name',
        width: 200,
        minWidth: 200,
        pinned: 'left',
        editable: readOnly ? false : (params) => !params.data?.product_id || !!params.data?._isNew,
        ...(!readOnly && {
          cellEditor: ProductCellEditor,
          cellEditorParams: (params: any) => ({
            products,
            onProductSelect: (product: Product) => handleProductSelect(params.node, product),
            stopEditing: () => params.api.stopEditing(),
            navigateToQuantity: () => {
              params.api.startEditingCell({
                rowIndex: params.node.rowIndex!,
                colKey: 'quantity'
              })
            }
          }),
          suppressKeyboardEvent: (params: any) => {
            if (!params.editing) return false
            const key = params.event.key
            return key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp'
          },
        }),
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
        editable: !readOnly,
        type: 'numericColumn',
        headerClass: 'ag-header-cell-center',
        cellClass: 'text-center',
        valueFormatter: (params) => (params.value || 0).toLocaleString()
      },
      {
        headerName: '단가',
        field: 'unit_cost',
        width: 110,
        minWidth: 110,
        editable: !readOnly,
        type: 'numericColumn',
        headerClass: 'ag-header-cell-center',
        cellClass: 'text-right',
        valueFormatter: (params) => `₩${(params.value || 0).toLocaleString()}`
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
        valueFormatter: (params) => `₩${(params.value || 0).toLocaleString()}`
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
        valueFormatter: (params) => `₩${(params.value || 0).toLocaleString()}`
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
        valueFormatter: (params) => `₩${(params.value || 0).toLocaleString()}`
      },
      {
        headerName: '비고',
        field: 'notes',
        width: 130,
        minWidth: 130,
        editable: !readOnly,
        cellClass: 'text-center text-sm'
      },
    ]

    if (!readOnly) {
      cols.push({
        headerName: '삭제',
        width: 60,
        minWidth: 60,
        cellRenderer: DeleteButtonRenderer,
        sortable: false,
        editable: false
      })
    }

    return cols
  }, [products, handleProductSelect, DeleteButtonRenderer, readOnly])

  const defaultColDef = useMemo(() => ({
    sortable: false,
    resizable: true,
    headerClass: 'ag-header-cell-center',
    cellClass: 'text-center'
  }), [])

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[75vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            거래번호: {referenceNumber || '(없음)'}
          </DialogTitle>
          <div className="text-base text-gray-900 mt-2">
            입고일: {items[0]?.purchase_date ? new Date(items[0].purchase_date).toLocaleDateString('ko-KR') : '-'} |
            공급업체: {items[0]?.client_name || '(없음)'} |
            품목 수: <span className="font-semibold text-blue-600">{validRowCount}</span>개 |
            공급가: <span className="font-semibold">₩{totalSupply.toLocaleString()}</span> |
            부가세: <span className="font-semibold text-orange-600">₩{totalTax.toLocaleString()}</span> |
            총액: <span className="font-semibold text-blue-600">₩{totalAmount.toLocaleString()}</span> |
            담당자: <span className="font-medium">{items[0]?.created_by_name || '알 수 없음'}</span>
            {(() => { const latest = items.filter(i => i.updated_by_name && i.updated_at).sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())[0]; return latest ? <> | 수정담당자: <span className="font-medium text-purple-600">{latest.updated_by_name}</span></> : null; })()}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto ag-theme-alpine">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            singleClickEdit={!readOnly}
            stopEditingWhenCellsLoseFocus={true}
            suppressMovableColumns={true}
            rowHeight={40}
            headerHeight={45}
            domLayout="autoHeight"
            {...(!readOnly && {
              onCellValueChanged,
              onCellEditingStarted,
              onCellKeyDown,
              tabToNextCell,
            })}
          />
        </div>

        <div className="border-t pt-3 flex justify-between items-center">
          <div className="text-sm text-gray-900">
            입력 품목: <span className="font-bold text-blue-600">{validRowCount}</span>개 |
            합계: <span className="font-bold text-red-600">₩{totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            {!readOnly && canEdit && (
              <button
                onClick={handleBulkSave}
                disabled={isSaving}
                className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold shadow-lg"
              >
                {isSaving ? '저장 중...' : '일괄 저장'}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {ConfirmDialogComponent}
    </>
  )
}
