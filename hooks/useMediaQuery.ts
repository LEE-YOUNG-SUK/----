'use client'

import { useState, useEffect } from 'react'

/**
 * 미디어 쿼리를 감지하는 Hook
 * @param query - CSS 미디어 쿼리 문자열 (예: '(max-width: 767px)')
 * @returns 미디어 쿼리 매칭 여부
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    // 초기값 설정
    setMatches(media.matches)

    // 변경 감지
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    // 리스너 등록
    media.addEventListener('change', listener)

    // 클린업
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

/**
 * 모바일 여부를 감지하는 Hook (767px 이하)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
