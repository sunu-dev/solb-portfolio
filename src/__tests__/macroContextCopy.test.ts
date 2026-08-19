import { describe, it, expect } from 'vitest';
import { US10Y_EDU_CARD } from '@/config/macroContextCopy';
import { FORBIDDEN_PHRASES } from '@/utils/alertCompliance';

/**
 * §6 — 시장 맥락 교육 카피 누출 불변식.
 *
 * 이 카피는 사용자에게 정적으로 렌더된다(AI 게이트 미경유).
 * '가치 있는 버전은 위법, 합법 버전은 무가치' 협공을 피하는 v1의 안전선이
 * 이 카피 전체이므로, 금지 어휘 검사 + **공식 준수(양방향·아무도모름·참고용)를
 * 양성 불변식으로** 함께 박제한다. 문구를 고치더라도 공식은 지켜야 한다.
 * 설계: docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md §4·§5
 */

/** 미래 단정·시그널·타이밍 (lint-alerts FORECAST_FORBIDDEN 미러 + 파생) */
const FORECAST_FORBIDDEN = [
  '오를 것', '내릴 것', '상승할 것', '하락할 것', '급등할', '급락할',
  '반등할', '반등이 기대', '반등을 기대',
  '가능성이 높', '가능성이 큽', '확률이 높',
  '기대됩니다', '기대되지만', '기대돼요',
  '전망됩니다', '예상됩니다', '예상돼요',
  '저점 가능', '고점 가능', '매도 신호', '매수 신호',
];

/** 매매 전략·행동 지시 */
const STRATEGY_FORBIDDEN = [
  '매수하세요', '매도하세요', '매수 타이밍', '매도 타이밍',
  '비중을 줄', '비중을 늘', '피하세요', '익절', '손절하세요',
];

/** 인과 단정 — 사실은 병렬로만 (금리→주가 인과 서술 금지) */
const CAUSAL_FORBIDDEN = ['때문', '덕분', '여파', '영향으로', '이끌'];

/** 조건부 일반화 — "X면 보통 Y"는 문법상 서술이어도 실질 매매권유 */
const CONDITIONAL_FORBIDDEN = ['보통 오르', '보통 내리', '보통 올라', '보통 내려', '경향이 있', '흔히 오르', '흔히 내리'];

const ALL_TEXT = Object.values(US10Y_EDU_CARD).join(' ');

describe('§6 — 미 국채 10년물 교육 카피', () => {
  it.each([
    ...FORECAST_FORBIDDEN,
    ...STRATEGY_FORBIDDEN,
    ...CAUSAL_FORBIDDEN,
    ...CONDITIONAL_FORBIDDEN,
  ])('금지 어휘 "%s"를 포함하지 않는다', phrase => {
    expect(ALL_TEXT.includes(phrase)).toBe(false);
  });

  it('전역 FORBIDDEN_PHRASES도 통과한다', () => {
    const hits = FORBIDDEN_PHRASES.filter(p => ALL_TEXT.includes(p));
    expect(hits).toEqual([]);
  });

  // ── 양성 불변식: 공식 자체를 박제 ──

  it('양방향 서술 — 내린 날과 오른 날을 함께 말한다', () => {
    expect(US10Y_EDU_CARD.bothWays).toContain('내린 날도');
    expect(US10Y_EDU_CARD.bothWays).toContain('오른 날도');
  });

  it('미래 봉인 — "아무도" + "참고"가 있다', () => {
    expect(US10Y_EDU_CARD.unknowable).toContain('아무도');
    expect(US10Y_EDU_CARD.unknowable).toContain('참고');
  });

  it('고지 — 출처와 비권유가 있다', () => {
    expect(US10Y_EDU_CARD.footnote).toContain('미국 재무부');
    expect(US10Y_EDU_CARD.footnote).toContain('권유하지 않');
  });
});
