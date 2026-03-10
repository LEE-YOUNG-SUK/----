'use client'

/**
 * 품목 검색 모달
 * - 체크박스 클릭: 해당 품목 즉시 그리드에 추가, 모달 유지 (계속 추가 가능)
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

  // 체크박스 클릭 → 즉시 추가, 모달 유지
  const handleCheckboxAdd = useCallback((e: React.MouseEvent, product: T) => {
    e.stopPropagation()
    onAdd(product)
    // 모달은 열린 상태 유지
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
      <DialogContent className="max-w-3xl">
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

        {/* 품목 목록 */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto border rounded-lg">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">검색 결과가 없습니다.</div>
          ) : (
            filtered.map((product) => {
              const isAdded = addedProductIds?.has(product.id) ?? false
              return (
                <div
                  key={product.id}
                  onClick={() => handleRowClick(product)}
                  className={`px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition select-none ${
                    isAdded ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* 체크박스: 클릭 시 추가 (모달 유지) */}
                    <input
                      type="checkbox"
                      checked={isAdded}
                      onChange={() => {}}
                      onClick={(e) => handleCheckboxAdd(e, product)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
                    />

                    {/* 품목 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-blue-600">
                          {product.code}
                        </span>
                        {product.category && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-900 rounded">
                            {product.category}
                          </span>
                        )}
                        {isAdded && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                            추가됨
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      {(product.specification || product.manufacturer) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                          {product.specification && (
                            <span>규격: {product.specification}</span>
                          )}
                          {product.manufacturer && (
                            <span>• 제조사: {product.manufacturer}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 가격 정보 */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-600 mb-1">
                        {product.unit}
                      </div>
                      <div className="text-sm font-bold text-green-600">
                        ₩{(product.standard_purchase_price ?? product.standard_sale_price ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <DialogFooter>
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            닫기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
