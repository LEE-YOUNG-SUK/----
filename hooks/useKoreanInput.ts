/**
 * 영타→한글 실시간 변환 훅
 * AG Grid 셀 에디터 / 검색 input에서 사용
 *
 * 영문 IME 상태에서 타이핑하면 한글로 자동 변환
 * 한글 IME 상태에서는 브라우저 기본 동작 그대로 유지
 */

import { useState, useRef, useCallback } from 'react'
import { KEY_MAP, englishToKorean } from '@/lib/hangul-utils'

interface UseKoreanInputOptions {
  initialValue?: string
  onChange?: (value: string) => void  // 값 변경 시 외부 알림
}

export function useKoreanInput(options: UseKoreanInputOptions = {}) {
  const { initialValue = '', onChange } = options
  const [inputValue, setInputValueState] = useState(initialValue)

  // 영문 키 버퍼 (변환 모드일 때만 사용)
  const rawBufferRef = useRef<string>('')
  // 현재 영타→한글 변환 모드인지
  const isConvertingRef = useRef(false)
  // 변환된 텍스트 앞에 붙일 접두사 (한글 IME로 입력된 부분)
  const prefixRef = useRef<string>('')

  // 외부에서 값 설정 (품목 선택 시 등) - 버퍼 초기화
  const setInputValue = useCallback((value: string) => {
    rawBufferRef.current = ''
    isConvertingRef.current = false
    prefixRef.current = ''
    setInputValueState(value)
    onChange?.(value)
  }, [onChange])

  // 값 업데이트 내부용
  const updateValue = useCallback((value: string) => {
    setInputValueState(value)
    onChange?.(value)
  }, [onChange])

  /**
   * keyDown 핸들러
   * @returns true: 이 훅이 처리함 (호출자는 무시), false: 호출자가 처리해야 함
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 IME 조합 중이면 무조건 브라우저에 위임
    if (e.nativeEvent.isComposing || e.key === 'Process') return false

    // 네비게이션/특수 키는 호출자에게 위임
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight',
         'Enter', 'Escape', 'Tab', 'Home', 'End',
         'Delete', 'F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) {
      return false
    }

    // Backspace 처리
    if (e.key === 'Backspace') {
      if (isConvertingRef.current && rawBufferRef.current.length > 0) {
        e.preventDefault()
        rawBufferRef.current = rawBufferRef.current.slice(0, -1)
        if (rawBufferRef.current.length === 0) {
          isConvertingRef.current = false
          // 접두사만 남기기
          if (prefixRef.current) {
            updateValue(prefixRef.current)
          } else {
            updateValue('')
          }
        } else {
          const converted = englishToKorean(rawBufferRef.current)
          updateValue(prefixRef.current + converted)
        }
        return true
      }
      // 변환 모드가 아니면 브라우저 기본 처리
      // 접두사도 같이 줄어들 수 있으므로 초기화
      prefixRef.current = ''
      return false
    }

    // 2벌식 매핑에 있는 영문 키 → 한글로 변환
    if (KEY_MAP[e.key]) {
      e.preventDefault()

      // 변환 모드 진입 시 현재 input 값을 접두사로 저장
      if (!isConvertingRef.current) {
        prefixRef.current = inputValue
        isConvertingRef.current = true
        rawBufferRef.current = ''
      }

      rawBufferRef.current += e.key
      const converted = englishToKorean(rawBufferRef.current)
      updateValue(prefixRef.current + converted)

      // 커서를 끝으로 이동
      const target = e.target as HTMLInputElement
      requestAnimationFrame(() => {
        if (target) {
          const len = target.value.length
          target.setSelectionRange(len, len)
        }
      })
      return true
    }

    // 그 외 문자 (숫자, 특수문자 등) → 변환 모드 해제
    if (e.key.length === 1) {
      rawBufferRef.current = ''
      isConvertingRef.current = false
      prefixRef.current = ''
      return false
    }

    return false
  }, [inputValue, updateValue])

  // onChange 핸들러 (한글 IME 또는 직접 입력용)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // 영타 변환 모드에서는 무시 (handleKeyDown에서 직접 제어)
    if (isConvertingRef.current) return
    prefixRef.current = ''
    updateValue(e.target.value)
  }, [updateValue])

  // compositionStart: 한글 IME 시작 → 영문 버퍼 초기화
  const handleCompositionStart = useCallback(() => {
    // 변환 모드였으면 현재까지의 변환 결과를 접두사에 합침
    if (isConvertingRef.current) {
      const converted = englishToKorean(rawBufferRef.current)
      prefixRef.current = prefixRef.current + converted
    }
    rawBufferRef.current = ''
    isConvertingRef.current = false
  }, [])

  // compositionEnd: 한글 IME 조합 완료
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    prefixRef.current = ''
    updateValue(e.currentTarget.value)
  }, [updateValue])

  // 붙여넣기: 버퍼 초기화
  const handlePaste = useCallback(() => {
    rawBufferRef.current = ''
    isConvertingRef.current = false
    prefixRef.current = ''
  }, [])

  return {
    inputValue,
    setInputValue,
    handleKeyDown,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    handlePaste,
  }
}
