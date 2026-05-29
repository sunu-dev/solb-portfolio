/**
 * 한국어 카피 톤 매핑 SSOT
 *
 * 정책: docs/KOREAN_UI_SYSTEM.md §3.3
 *
 * 페르소나: 20~30대 초보 학습자. 토스/카카오뱅크풍 구어체 친근형 ("~이에요", "~있어요").
 *
 * 격식 톤 → 토스 톤 매핑:
 *   "있습니다" → "있어요"
 *   "됩니다" → "돼요"
 *   "필요합니다" → "필요해요"
 *
 * **예외 (격식 유지 의무)**:
 *   - 약관·개인정보처리방침 (법적 문서)
 *   - Disclaimer 컴포넌트 (정식 면책)
 *   - 자본시장법 §6 회피 카피 (분쟁 증거)
 *
 * 사용 예:
 *   toTossTone("정보가 부족합니다.")  // "정보가 부족해요."
 *   toTossTone("확인하세요.")          // "확인해주세요."
 *
 * 면책·약관에서는 호출 금지.
 */

/** 격식 종결 어휘 → 토스 톤 매핑 (긴 패턴 우선 매칭으로 충돌 방지) */
export const TOSS_TONE_MAP: Record<string, string> = {
  // 종결 어휘 (긴 것부터)
  '있습니다': '있어요',
  '없습니다': '없어요',
  '됩니다': '돼요',
  '됐습니다': '됐어요',
  '필요합니다': '필요해요',
  '제공됩니다': '제공돼요',
  '추천합니다': '안내해드려요',  // "추천" 자체 회피 (자본시장법 §6)
  '확인하세요': '확인해주세요',
  '주의하세요': '주의해주세요',
  '입력하세요': '입력해주세요',
  '선택하세요': '선택해주세요',
  '시작하세요': '시작해보세요',
  '이용하세요': '이용해주세요',
  '맞습니다': '맞아요',
  '아닙니다': '아니에요',
  '같습니다': '같아요',
  '봅니다': '봐요',
  '드립니다': '드려요',
  // 단순 종결 — "입니다" 끝나는 문장은 "예요/이에요"로 (받침 처리는 단순화)
};

/**
 * 텍스트의 격식 종결을 토스 톤으로 변환.
 *
 * 주의: 약관·면책·법무 영역에서 호출 금지. 격식 유지가 면책 강도 또는 법적 효력에 영향.
 *
 * @param text 원본 텍스트 (격식 톤)
 * @returns 토스 톤으로 변환된 텍스트
 */
export function toTossTone(text: string): string {
  if (!text) return text;
  let result = text;
  // 긴 패턴부터 매칭 (충돌 방지: "있습니다" 먼저, "습니다" 일반화 X)
  const sortedKeys = Object.keys(TOSS_TONE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (result.includes(key)) {
      result = result.split(key).join(TOSS_TONE_MAP[key]);
    }
  }
  return result;
}

/**
 * 텍스트가 격식 톤을 포함하는지 검사 (lint:korean 보조용).
 *
 * @returns 격식 종결 어휘 목록 (있으면 lint 위반)
 */
export function detectFormalTone(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const key of Object.keys(TOSS_TONE_MAP)) {
    if (text.includes(key)) found.push(key);
  }
  return found;
}