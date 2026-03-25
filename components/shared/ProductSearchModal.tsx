'use client'

/**
 * 품목 검색 모달
 * - [추가] 클릭: 해당 품목 즉시 그리드에 추가, 모달 유지 (같은 품목 중복 추가 가능)
 * - 행 직접 클릭: 해당 품목 1개 그리드에 추가, 모달 자동 닫힘
 * - 닫기: 모달만 닫힘, 이미 추가된 품목은 유지
 * - 영타→한글 실시간 변환 지원
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { englishToKorean } from '@/lib/hangul-utils'
import { useKoreanInput } from '@/hooks/useKoreanInput'
interface SearchableProduct {
  id: string
  code: string
  name: string
  category?: string | null
  unit: string
  specification?: string | null
  manufacturer?: string | null
  standard_purchase_price?: number | null
  standard_sale_price?: number | null
}

interface ProductSearchModalProps<T extends SearchableProduct> {
  isOpen: boolean
  onClose: () => void
  onAdd: (product: T) => void  // 품목 1개 즉시 추가
  products: T[]
  initialSearch?: string
  addedProductIds?: Set<string>  // 이미 추가된 품목 ID (중복 표시용)
}

export default function ProductSearchModal<T extends SearchableProduct>({
  isOpen,
  onClose,
  onAdd,
  products,
  initialSearch = '',
  addedProductIds
}: ProductSearchModalProps<T>) {
  const korean = useKoreanInput({ initialValue: initialSearch })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevIsOpenRef = useRef(false)

  // 모달이 열리는 순간에만 검색어 설정 + 포커스
  // (이미 열린 상태에서 initialSearch 변경 시에는 무시)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      korean.setInputValue(initialSearch)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, initialSearch])

  // 검색 필터링 (최대 50개, 영타→한글 변환 포함)
  const filtered = useMemo(() => {
    if (korean.inputValue.length < 1) return products.slice(0, 50)
    const search = korean.inputValue.toLowerCase()
    // 영타→한글 변환 (영문 입력 시 한글로 변환하여 추가 검색)
    const koreanConverted = englishToKorean(korean.inputValue)
    return products
      .filter(p => {
        const code = p.code.toLowerCase()
        const name = p.name.toLowerCase()
        // 원본 검색어로 매칭
        if (code.includes(search) || name.includes(search)) return true
        // 영타→한글 변환 검색어로 매칭
        if (koreanConverted && name.includes(koreanConverted.toLowerCase())) return true
        return false
      })
      .slice(0, 50)
  }, [korean.inputValue, products])

  // [추가] 클릭 → 즉시 추가, 모달 유지 (같은 품목 중복 추가 가능)
  const handleInlineAdd = useCallback((e: React.MouseEvent, product: T) => {
    e.stopPropagation()
    onAdd(product)
  }, [onAdd])

  // 행 직접 클릭 → 즉시 추가 + 모달 닫힘
  const handleRowClick = useCallback((product: T) => {
    onAdd(product)
    onClose()
  }, [onAdd, onClose])

  // 검색 input 키보드 이벤트
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME 조합 중이면 무시
    if (e.nativeEvent.isComposing || e.key === 'Process') return

    // 영타→한글 변환 훅에 위임
    korean.handleKeyDown(e)
  }, [korean])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent style={{ width: 768, maxWidth: 'calc(100vw - 2rem)' }}>
        <DialogHeader>
          <DialogTitle>품목 검색</DialogTitle>
        </DialogHeader>

        {/* 검색 입력 */}
        <div className="mb-3">
          <input
            ref={inputRef}
            type="text"
            value={korean.inputValue}
            onChange={korean.handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={korean.handleCompositionStart}
            onCompositionEnd={korean.handleCompositionEnd}
            onPaste={korean.handlePaste}
            placeholder="품목코드 또는 품목명 입력"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          />
        </div>

        {/* 결과 건수 */}
        <div className="mb-2 text-sm text-gray-600">
          검색 결과: {filtered.length}건
        </div>

        {/* 품목 목록 (테이블) */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto border rounded-lg">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">검색 결과가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  <th className="w-14 px-2 py-2">{' '}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">품목코드</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">품목명</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">규격</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">단위</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">단가</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const isAdded = addedProductIds?.has(product.id) ?? false
                  return (
                    <tr
                      key={product.id}
                      onClick={() => handleRowClick(product)}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition select-none ${
                        isAdded ? 'bg-green-50' : ''
                      }`}
                    >
                      <td
                        className="px-2 py-1.5 text-center cursor-pointer hover:bg-blue-100 transition"
                        onClick={(e) => handleInlineAdd(e, product)}
                      >
                        <span className="text-blue-600 underline font-medium text-xs whitespace-nowrap">
                          추가
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className="font-bold text-blue-600">{product.code}</span>
                        {isAdded && (
                          <span className="ml-1 text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded font-medium">추가됨</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-gray-900 truncate max-w-[200px]">
                        {product.name}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 truncate max-w-[120px]">
                        {product.specification || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-600 whitespace-nowrap">
                        {product.unit}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold text-green-600 whitespace-nowrap">
                        ₩{(product.standard_purchase_price ?? product.standard_sale_price ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 하단 버튼 */}
        <DialogFooter>
          <div className="flex gap-2">
            {filtered.length > 0 && (() => {
              const notAdded = filtered.filter(p => !addedProductIds?.has(p.id))
              return (
                <button
                  onClick={() => { notAdded.forEach(p => onAdd(p)); onClose() }}
                  disabled={notAdded.length === 0}
                  className="px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  전체 추가 ({notAdded.length})
                </button>
              )
            })()}
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              닫기
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
