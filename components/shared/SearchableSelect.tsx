'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '선택하세요',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 현재 선택된 옵션의 라벨
  const selectedLabel = options.find((o) => o.value === value)?.label || ''

  // 필터링된 옵션
  const filtered = searchTerm
    ? options.filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 드롭다운 열 때 입력에 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
    if (e.key === 'Enter' && filtered.length === 1) {
      e.preventDefault()
      handleSelect(filtered[0].value)
    }
  }

  const baseClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 입력 필드 */}
      <div
        className={`${baseClass} flex items-center cursor-pointer bg-white ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            setSearchTerm('')
          }
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedLabel || placeholder}
            className="w-full outline-none bg-transparent text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${value ? 'text-gray-900' : 'text-gray-800'}`}>
            {selectedLabel || placeholder}
          </span>
        )}
        {/* 화살표 아이콘 */}
        <svg
          className={`w-4 h-4 ml-1 flex-shrink-0 text-gray-800 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 드롭다운 목록 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* 선택 해제 옵션 */}
          <div
            onClick={() => handleSelect('')}
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-800 ${
              !value ? 'bg-blue-50 font-medium' : ''
            }`}
          >
            {placeholder}
          </div>
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 transition ${
                  option.value === value ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-900'
                }`}
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-800">검색 결과 없음</div>
          )}
        </div>
      )}
    </div>
  )
}
