/**
 * 매크로 교육 카피 정적 정책 SSOT.
 *
 * lint-alerts와 Vitest가 같은 목록·판정 함수를 쓰게 해, 한쪽만 보강되고 다른 쪽에
 * 사각이 남는 일을 막는다. 이 정책은 macroContextCopy에만 적용한다. 2026-08-20
 * 전역 승격을 실측했을 때 기존 src에서 172줄이 걸렸다. 포트폴리오 UI의 사실 라벨
 * (`평단`, `비중`)과 날씨 인사(`조심하세요`)까지 차단하므로 전역 적용은 과차단이다.
 * 대신 다른 파일에서 매크로 카피를 새로 만들면 이 파일명 기반 가드를 우회할 수 있다.
 * 그래서 사용자 노출 문장은 macroContextCopy SSOT에만 두고 컴포넌트에서 조립하지 않는다.
 */

/** 미래 방향 단정·검증되지 않은 확률 표현 — lint의 전역 규칙과 매크로 테스트가 공유한다. */
export const GLOBAL_FORECAST_FORBIDDEN = Object.freeze([
  '오를 것', '내릴 것', '상승할 것', '하락할 것', '급등할', '급락할',
  '반등할', '반등이 기대', '반등을 기대',
  '가능성이 높', '가능성이 큽', '확률이 높',
  '기대됩니다', '기대되지만', '기대돼요',
  '전망됩니다', '예상됩니다', '예상돼요',
  '효과적이었', '유효한 전략', '매수 타이밍이었', '매도 타이밍이었',
  '저점 가능', '고점 가능', '매도 신호', '매수 신호',
]);

/** 인과·조건부 일반화·경사 및 이번 심화에서 추가한 문형 */
export const MACRO_COPY_FORBIDDEN = Object.freeze([
  '때문', '덕분', '여파', '영향으로', '로 인해', '으로 인해',
  '보통 오', '보통 내', '흔히 오', '흔히 내', '대체로', '역사적으로', '경향이 있', '곤 해요', '곤 했',
  '불리', '유리', '부담', '호재', '악재', '눌리', '약세', '강세',
  '인상기', '상승 시', '높아질수록', '둔화하면',
  // 2026-08-20 재감사: 저금리 지표(일본)에서 자연스러운 거울 형태와 기본 조건절이 빠져 있었다
  '낮을수록', '낮아질수록', '오르면', '내리면', '올리면', '인상하면', '인하하면',
  '청산되면', '청산이 시작되면', '되감기',
  '가능성이 커', '신호로 볼', '징후', '시사해',
  '예상보다', '컨센서스', '서프라이즈',
  '대비하세요', '조심하세요', '눈여겨', '방어해', '발표 전에',
]);

/** 사용자별 투자 판단으로 읽히는 토큰 */
export const MACRO_PERSONALIZATION_FORBIDDEN = Object.freeze([
  '회원님', '보유 종목', '내 포트', '평단', '비중', '위험성향',
]);

/** 상품·시장과 같은 문장에 놓이면 방향 판단이 되는 대상어 */
export const MACRO_PRODUCT_TERMS = Object.freeze([
  '주가', '코스피', '코스닥', '성장주', '기술주', '반도체', '보유주',
  // 2026-08-20 재감사: 일본 카드가 SSOT에 '한국 증시'를 처음 등장시켰는데 대상어가 없어
  // '일본 금리 → 한국 증시' 인과문 13/14가 통과했다. 시장·자금 계열을 대상어로 편입한다.
  '증시', '시장', '자금', '수급', '유동성', '위험자산', '외국인',
]);

/** 활용형을 포함하도록 어간으로 둔다: 떨어져요·약해졌어요·수혜를 모두 잡는다. */
export const MACRO_DIRECTION_TERMS = Object.freeze([
  '떨어', '약해', '매력 감소', '수혜', '피해', '유망', '우위',
  // 2026-08-20 재감사: '흔들려요'·'빠져나가요'·'조정을 받아요'가 전부 탈출했다.
  // 어간으로 등록해 활용형(흔들려/흔들렸/흔들리면)을 함께 잡는다.
  '흔들', '빠져', '조정', '강해', '떠받', '유입', '유출', '흘러', '낮춰', '높여', '선호를',
]);

/** @param {string} text */
export function splitKoreanSentences(text) {
  return text
    .split(/(?<=[.!?。！？])\s*/u)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

/**
 * 실제 UI 문장과 소스의 한 줄 모두 검사할 수 있는 순수 함수.
 * 상품×방향은 전체 텍스트가 아니라 문장별로 결합을 확인한다.
 *
 * @param {string} text
 * @returns {Array<{ kind: 'phrase' | 'personalization' | 'product-direction', match: string, sentence: string }>}
 */
export function findMacroCopyViolations(text) {
  const violations = [];

  for (const sentence of splitKoreanSentences(text)) {
    for (const phrase of MACRO_COPY_FORBIDDEN) {
      if (sentence.includes(phrase)) {
        violations.push({ kind: 'phrase', match: phrase, sentence });
      }
    }

    for (const phrase of MACRO_PERSONALIZATION_FORBIDDEN) {
      if (sentence.includes(phrase)) {
        violations.push({ kind: 'personalization', match: phrase, sentence });
      }
    }

    const product = MACRO_PRODUCT_TERMS.find(term => sentence.includes(term));
    const direction = MACRO_DIRECTION_TERMS.find(term => sentence.includes(term));
    if (product && direction) {
      violations.push({
        kind: 'product-direction',
        match: `${product}×${direction}`,
        sentence,
      });
    }
  }

  return violations;
}
