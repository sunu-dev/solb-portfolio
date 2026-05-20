/**
 * 한국어 조사 자동 선택 유틸
 *
 * 단어 끝 글자의 받침(종성) 유무를 판단해 올바른 조사를 반환.
 * 동적으로 만들어지는 한국어 텍스트에서 "투자자이" 같은 잘못된 조사 결합 방지.
 *
 * 사용 예:
 *   `${nameKr}${iGa(nameKr)} 자주 보는` // "성장 투자자가 자주 보는"
 *   `${pattern}${eulReul(pattern)} 형성` // "골든크로스를 형성"
 */

/** 한글 음절 범위 */
const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;

/** 단어의 끝 글자에 받침(종성)이 있는지 판단 */
export function hasJongseong(word: string): boolean {
  if (!word) return false;
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) {
    // 한글이 아닌 경우 (영문/숫자/기호): 한국어 화자가 흔히 받침으로 발음하는 영문자 처리
    // 베타 단계: 보수적으로 false (받침 없음) 처리. 향후 영문 발음 룰 추가 가능.
    return false;
  }
  return (code - HANGUL_SYLLABLE_START) % 28 !== 0;
}

/** 종성이 'ㄹ'인지 (도구격 조사 '으로/로' 판단용) */
function hasRieulJongseong(word: string): boolean {
  if (!word) return false;
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return false;
  // 종성 인덱스 8 = 'ㄹ'
  return (code - HANGUL_SYLLABLE_START) % 28 === 8;
}

/** 주격/보격 조사: 받침 있으면 '이', 없으면 '가' */
export function iGa(word: string): string {
  return hasJongseong(word) ? '이' : '가';
}

/** 보조사: 받침 있으면 '은', 없으면 '는' */
export function eunNeun(word: string): string {
  return hasJongseong(word) ? '은' : '는';
}

/** 목적격 조사: 받침 있으면 '을', 없으면 '를' */
export function eulReul(word: string): string {
  return hasJongseong(word) ? '을' : '를';
}

/** 접속 조사: 받침 있으면 '과', 없으면 '와' */
export function gwaWa(word: string): string {
  return hasJongseong(word) ? '과' : '와';
}

/** 도구/방향 조사: 받침 없거나 'ㄹ' 받침이면 '로', 그 외 '으로' */
export function euroRo(word: string): string {
  if (!word) return '로';
  if (!hasJongseong(word)) return '로';
  if (hasRieulJongseong(word)) return '로';
  return '으로';
}

/** 한국어 단어 + 주격 조사를 한 번에 (자주 쓰는 패턴 헬퍼) */
export function withIGa(word: string): string {
  return word + iGa(word);
}

/** 한국어 단어 + 보조사 */
export function withEunNeun(word: string): string {
  return word + eunNeun(word);
}

/** 한국어 단어 + 목적격 조사 */
export function withEulReul(word: string): string {
  return word + eulReul(word);
}
