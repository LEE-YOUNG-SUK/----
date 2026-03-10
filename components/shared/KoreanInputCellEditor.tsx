'use client'

/**
 * 영타→한글 변환 전용 경량 셀 에디터
 * 드롭다운 없이 useKoreanInput만 적용하여 입력 시 한글 자동 변환
 * 모달 방식 품목 선택과 함께 사용
 */

import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { useKoreanInput } from '@/hooks/useKoreanInput'

interface KoreanInputCellEditorProps {
  value: string
}

export const KoreanInputCellEditor = forwardRef((props: KoreanInputCellEditorProps, ref) => {
  const korean = useKoreanInput({ initialValue: props.value || '' })
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    getValue: () => korean.inputValue,
    isCancelAfterEnd: () => false,
  }))

  // 마운트 시 포커스
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key === 'Process') return
    // Enter/Escape/Tab은 AG Grid의 suppressKeyboardEvent에서 처리
    korean.handleKeyDown(e)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={korean.inputValue}
      onChange={korean.handleChange}
      onKeyDown={handleKeyDown}
      onCompositionStart={korean.handleCompositionStart}
      onCompositionEnd={korean.handleCompositionEnd}
      onPaste={korean.handlePaste}
      className="w-full h-full px-2 border-none outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="검색어 입력 후 Enter"
    />
  )
})

KoreanInputCellEditor.displayName = 'KoreanInputCellEditor'

export default KoreanInputCellEditor
