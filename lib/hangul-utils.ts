/**
 * 영타 → 한글 자동변환 유틸
 * 2벌식 키보드 기준 영문 입력을 한글로 조합하여 반환
 * 예: "flfxm" → "리프테", "gksrmf" → "한글"
 */

// 2벌식 키보드 매핑 (영문 → 한글 자모)
export const KEY_MAP: Record<string, string> = {
  // 자음
  'r': 'ㄱ', 'R': 'ㄲ', 's': 'ㄴ', 'e': 'ㄷ', 'E': 'ㄸ',
  'f': 'ㄹ', 'a': 'ㅁ', 'q': 'ㅂ', 'Q': 'ㅃ', 't': 'ㅅ',
  'T': 'ㅆ', 'd': 'ㅇ', 'w': 'ㅈ', 'W': 'ㅉ', 'c': 'ㅊ',
  'z': 'ㅋ', 'x': 'ㅌ', 'v': 'ㅍ', 'g': 'ㅎ',
  // 모음
  'k': 'ㅏ', 'o': 'ㅐ', 'i': 'ㅑ', 'O': 'ㅒ', 'j': 'ㅓ',
  'p': 'ㅔ', 'u': 'ㅕ', 'P': 'ㅖ', 'h': 'ㅗ', 'y': 'ㅛ',
  'n': 'ㅜ', 'b': 'ㅠ', 'm': 'ㅡ', 'l': 'ㅣ',
}

// 초성 목록 (유니코드 순서)
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
]

// 중성 목록 (유니코드 순서)
const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
]

// 종성 목록 (유니코드 순서, 첫 번째는 종성 없음)
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
]

// 복합 모음 조합
const COMPOUND_VOWEL: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
}

// 복합 종성 조합
const COMPOUND_JONGSEONG: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
  'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ',
  'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
}

// 복합 종성 분리 (종성 → [앞 자음, 뒷 자음])
const DECOMPOSE_JONGSEONG: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
}

function isConsonant(ch: string): boolean {
  return CHOSEONG.includes(ch)
}

function isVowel(ch: string): boolean {
  return JUNGSEONG.includes(ch)
}

// 초성 + 중성 + 종성 → 완성형 한글
function compose(cho: string, jung: string, jong: string = ''): string {
  const choIdx = CHOSEONG.indexOf(cho)
  const jungIdx = JUNGSEONG.indexOf(jung)
  const jongIdx = JONGSEONG.indexOf(jong)
  if (choIdx < 0 || jungIdx < 0 || jongIdx < 0) return ''
  const code = 0xAC00 + choIdx * 21 * 28 + jungIdx * 28 + jongIdx
  return String.fromCharCode(code)
}

/**
 * 영문 키 입력을 한글로 변환 (2벌식 키보드 기준)
 * 영문이 아닌 문자(한글, 숫자, 특수문자)는 그대로 반환
 */
export function englishToKorean(input: string): string {
  // 영문 알파벳이 하나도 없으면 변환 불필요
  if (!/[a-zA-Z]/.test(input)) return ''

  // 영문 키를 한글 자모로 변환
  const jamos: string[] = []
  for (const ch of input) {
    if (KEY_MAP[ch]) {
      jamos.push(KEY_MAP[ch])
    } else {
      jamos.push(ch) // 숫자, 특수문자 등은 그대로
    }
  }

  // 한글 자모 조합 (오토마타)
  let result = ''
  let cho = ''   // 현재 초성
  let jung = ''  // 현재 중성
  let jong = ''  // 현재 종성

  function flush() {
    if (cho && jung) {
      result += compose(cho, jung, jong)
    } else if (cho) {
      result += cho
    } else if (jung) {
      result += jung
    }
    cho = ''
    jung = ''
    jong = ''
  }

  for (const jamo of jamos) {
    if (isConsonant(jamo)) {
      if (!cho) {
        // 초성 없음 → 초성 설정
        cho = jamo
      } else if (cho && !jung) {
        // 초성만 있고 중성 없음 → 이전 초성 출력, 새 초성
        flush()
        cho = jamo
      } else if (cho && jung && !jong) {
        // 초성 + 중성 있고 종성 없음 → 종성 후보
        if (JONGSEONG.includes(jamo)) {
          jong = jamo
        } else {
          flush()
          cho = jamo
        }
      } else if (cho && jung && jong) {
        // 이미 종성이 있음
        // 복합 종성 시도
        const compound = COMPOUND_JONGSEONG[jong + jamo]
        if (compound && JONGSEONG.includes(compound)) {
          jong = compound
        } else {
          // 복합 종성 불가 → 현재 글자 완성, 새 초성
          flush()
          cho = jamo
        }
      }
    } else if (isVowel(jamo)) {
      if (!cho) {
        // 초성 없이 모음 → 단독 모음
        jung = jamo
        flush()
      } else if (cho && !jung) {
        // 초성 + 모음 → 중성 설정
        jung = jamo
      } else if (cho && jung && !jong) {
        // 이미 중성 있음 → 복합 모음 시도
        const compound = COMPOUND_VOWEL[jung + jamo]
        if (compound) {
          jung = compound
        } else {
          // 복합 모음 불가 → 현재 글자 완성, 새 모음 (초성 없이)
          flush()
          jung = jamo
          flush()
        }
      } else if (cho && jung && jong) {
        // 종성이 있는 상태에서 모음 → 종성을 분리하여 다음 초성으로
        const decomposed = DECOMPOSE_JONGSEONG[jong]
        if (decomposed) {
          // 복합 종성 분리: 앞 자음은 종성으로 유지, 뒷 자음은 다음 초성
          jong = decomposed[0]
          flush()
          cho = decomposed[1]
          jung = jamo
        } else {
          // 단일 종성 → 종성을 다음 초성으로
          const prevJong = jong
          jong = ''
          flush()
          cho = prevJong
          jung = jamo
        }
      }
    } else {
      // 한글 자모가 아닌 문자 → 현재 조합 완성 후 그대로 출력
      flush()
      result += jamo
    }
  }

  // 남은 조합 완성
  flush()

  return result
}
