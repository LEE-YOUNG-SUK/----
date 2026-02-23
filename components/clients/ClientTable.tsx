'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/hooks/useConfirm'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import type { Client, UserData } from '@/types'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '../ui/Button'
import { deleteClient } from '@/app/clients/actions'
import ClientFilters from './ClientFilters'

interface ClientTableProps {
  clients: Client[]
  filteredClients: Client[]
  onFilterChange: (filtered: Client[]) => void
  permissions: {
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
  }
  onEdit: (client: Client) => void
  onAddNew: () => void
  userData: UserData
}

const columnHelper = createColumnHelper<Client>()

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ko-KR')
}

const formatTaxId = (taxId: string | null) => {
  if (!taxId) return '-'
  if (taxId.length === 10) {
    return `${taxId.slice(0, 3)}-${taxId.slice(3, 5)}-${taxId.slice(5)}`
  }
  return taxId
}

export default function ClientTable({
  clients,
  filteredClients,
  onFilterChange,
  permissions,
  onEdit,
  onAddNew,
  userData
}: ClientTableProps) {
  const router = useRouter()
  const { confirm, ConfirmDialogComponent } = useConfirm()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const canManageCommon = userData.is_headquarters && ['0000', '0001'].includes(userData.role)

  const handleDelete = async (client: Client) => {
    const ok = await confirm({ title: '삭제 확인', message: `'${client.name}' 거래처를 삭제하시겠습니까?\n\n연결된 입고/판매 내역이 있으면 삭제할 수 없습니다.`, variant: 'danger' })
    if (!ok) return

    setDeletingId(client.id)
    try {
      const result = await deleteClient(client.id)
      if (result.success) {
        alert(result.message)
        router.refresh()
      } else {
        alert(result.message)
      }
    } catch (error) {
      alert('거래처 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  const columns = [
    columnHelper.accessor('branch_id', {
      header: '구분',
      size: 100,
      cell: (info) => {
        const branchId = info.getValue()
        const branchName = info.row.original.branch_name
        return branchId ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {branchName || '지점'}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            공통
          </span>
        )
      },
    }),
    columnHelper.accessor('code', {
      header: '거래처코드',
      size: 120,
      cell: (info) => (
        <span className="font-mono text-sm font-medium text-gray-900 truncate block">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('name', {
      header: '상호명',
      size: 190,
      cell: (info) => (
        <span className="text-sm font-medium text-gray-900 truncate block">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('contact_person', {
      header: '대표자',
      size: 120,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    columnHelper.accessor('phone', {
      header: '연락처',
      size: 140,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    columnHelper.accessor('email', {
      header: '이메일',
      size: 160,
      cell: (info) => (
        <span className="text-sm text-gray-900 truncate block">{info.getValue() || '-'}</span>
      ),
    }),
    columnHelper.accessor('tax_id', {
      header: '사업자번호',
      size: 115,
      cell: (info) => (
        <span className="text-sm text-gray-900">{formatTaxId(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor('is_active', {
      header: '상태',
      size: 90,
      cell: (info) => {
        const active = info.getValue()
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {active ? '활성' : '비활성'}
          </span>
        )
      },
    }),
    columnHelper.accessor('created_at', {
      header: '등록일',
      size: 115,
      cell: (info) => (
        <span className="text-sm text-gray-900">{formatDate(info.getValue())}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '관리',
      size: 190,
      enableSorting: false,
      cell: (info) => {
        const client = info.row.original
        return (
          <div className="flex justify-end gap-2">
            {permissions.canUpdate && (
              <button
                onClick={() => onEdit(client)}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
              >
                ✏️ 수정
              </button>
            )}
            {permissions.canDelete && (
              <button
                onClick={() => handleDelete(client)}
                disabled={deletingId === client.id}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === client.id ? '⏳ 삭제중' : '🗑️ 삭제'}
              </button>
            )}
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: filteredClients,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  return (
    <>
    <ContentCard>
      {/* 필터 및 버튼 */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <ClientFilters
            clients={clients}
            onFilterChange={onFilterChange}
          />
          {permissions.canCreate && (
            <Button onClick={onAddNew} size="lg" className="whitespace-nowrap">
              ➕ 새 거래처 추가
            </Button>
          )}
        </div>
      </div>

      {/* 페이지네이션 */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              «
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ‹
            </button>
            {generatePageNumbers(table.getState().pagination.pageIndex, table.getPageCount()).map(
              (page, i) =>
                page === -1 ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-800">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition ${
                      table.getState().pagination.pageIndex === page
                        ? 'bg-blue-600 text-white font-medium'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page + 1}
                  </button>
                )
            )}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ›
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              »
            </button>
          </div>
          <span className="text-sm text-gray-900">
            총 {filteredClients.length}개 중 {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredClients.length
            )}
            개 표시
          </span>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full min-w-[1360px] table-fixed">
          <colgroup>
            {table.getAllColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`px-4 py-3 text-xs font-medium text-gray-900 uppercase tracking-wider text-center ${
                        canSort ? 'cursor-pointer select-none hover:bg-gray-100 transition' : ''
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-gray-800">
                            {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ' ↕'}
                          </span>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-900">
                  검색 결과가 없습니다
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition">
                  {row.getVisibleCells().map((cell) => {
                    const isLeft = cell.column.id === 'name'
                    return (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 ${isLeft ? 'text-left' : 'text-center'}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ContentCard>
    {ConfirmDialogComponent}
  </>
  )
}

/** 현재 페이지 주변 번호 + 처음/끝 표시, -1은 ellipsis */
function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)

  const pages: number[] = []
  pages.push(0)

  if (current > 2) pages.push(-1)

  const start = Math.max(1, current - 1)
  const end = Math.min(total - 2, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 3) pages.push(-1)

  pages.push(total - 1)
  return pages
}
