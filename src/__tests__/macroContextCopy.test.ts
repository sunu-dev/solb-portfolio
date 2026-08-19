import { describe, it, expect } from 'vitest';
import * as macroCopy from '@/config/macroContextCopy';
import { US10Y_EDU_CARD } from '@/config/macroContextCopy';
import { FORBIDDEN_PHRASES } from '@/utils/alertCompliance';

/**
 * §6 — 시장 맥락 교육 카피 누출 불변식.
 *
 * 이 카피는 사용자에게 정적으로 렌더된다(AI 게이트 미경유).
 * '가치 있는 버전은 위법, 합법 버전은 무가치' 협공 지점이라 미래 수정 압력이
 * 가장 큰 파일이므로, 금지 어휘 + **공식 준수(양방향·아무도모름·참고용) 양성
 * 불변식** + **금지 목록 자체의 검출력(탈출 프로브)** 3중으로 박제한다.
 *
 * 2026-08-19 적대 재감사가 §6 실질 위반 문형 9종이 초판 목록을 전부 통과함을
 * 실증 — 인과('로 인해')·경사(불리/부담/호재)·역사 일반화(대체로/역사적으로)
 * 계열을 보강하고, 그 프로브 문장들을 회귀 테스트로 남긴다.
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
const CAUSAL_FORBIDDEN = ['때문', '덕분', '여파', '영향으로', '이끌', '인해'];

/** 조건부·역사 일반화 — "X면 보통 Y"는 문법상 서술이어도 실질 매매권유 */
const CONDITIONAL_FORBIDDEN = [
  // '오르/내리'가 아니라 '오/내' 어간까지 줄인 이유: '흔히 내렸어요' 같은
  // 과거 활용형이 '흔히 내리'를 탈출한다 — 프로브가 실증 (2026-08-19)
  '보통 오', '보통 내', '흔히 오', '흔히 내', '경향이 있',
  '대체로', '역사적으로', '곤 해요', '곤 했',
];

/** 경사(valence) — 금리 카피에서 이 단어들은 곧 방향 판정이다 */
const VALENCE_FORBIDDEN = [
  '불리', '유리', '부담', '호재', '악재', '눌리', '짓누', '약세', '강세',
];

const ALL_FORBIDDEN = [
  ...FORECAST_FORBIDDEN,
  ...STRATEGY_FORBIDDEN,
  ...CAUSAL_FORBIDDEN,
  ...CONDITIONAL_FORBIDDEN,
  ...VALENCE_FORBIDDEN,
];

/**
 * 모듈 전체의 문자열 값을 재귀 수집 — export가 늘어나도 자동 편입.
 * (초판은 US10Y_EDU_CARD 하나만 검사해 새 export가 사각이 됐다)
 */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach(v => collectStrings(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => collectStrings(v, acc));
  return acc;
}
const ALL_TEXT = collectStrings(macroCopy).join(' ');

describe('§6 — 시장 맥락 교육 카피 (모듈 전체)', () => {
  it('모듈에 문자열 카피가 존재한다 (수집기 자가 검증)', () => {
    expect(ALL_TEXT.length).toBeGreaterThan(100);
  });

  it.each(ALL_FORBIDDEN)('금지 어휘 "%s"를 포함하지 않는다', phrase => {
    expect(ALL_TEXT.includes(phrase)).toBe(false);
  });

  it('전역 FORBIDDEN_PHRASES도 통과한다', () => {
    const hits = FORBIDDEN_PHRASES.filter(p => ALL_TEXT.includes(p));
    expect(hits).toEqual([]);
  });

  // ── 양성 불변식: 공식 자체를 박제 — *_EDU_CARD 전 카드에 강제.
  //    새 지표 카드를 추가하면 이 공식(양방향+아무도모름+참고용)을 지켜야 통과한다. ──

  const EDU_CARDS: Array<[string, Record<string, string>]> = Object.entries(macroCopy)
    .filter(([name]) => name.endsWith('_EDU_CARD'))
    .map(([name, card]) => [name, card as Record<string, string>]);

  it('교육 카드가 존재한다 (필터 자가 검증)', () => {
    expect(EDU_CARDS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(EDU_CARDS.map(([name]) => name))('%s — 양방향 서술(내린/오른 병기)', name => {
    const card = EDU_CARDS.find(([n]) => n === name)![1];
    expect(card.bothWays).toMatch(/내린 (날|적)도/);
    expect(card.bothWays).toMatch(/오른 (날|적)도/);
  });

  it.each(EDU_CARDS.map(([name]) => name))('%s — 미래 봉인("아무도"+"참고")', name => {
    const card = EDU_CARDS.find(([n]) => n === name)![1];
    expect(card.unknowable).toContain('아무도');
    expect(card.unknowable).toContain('참고');
  });

  it('고지 — 출처와 비권유가 있다', () => {
    expect(US10Y_EDU_CARD.footnote).toContain('미국 재무부');
    expect(US10Y_EDU_CARD.footnote).toContain('권유하지 않');
  });

  // ── 검출력 회귀: 2026-08-19 적대 재감사에서 초판 목록을 전부 탈출했던 문형들.
  //    목록을 다듬다가 검출력이 다시 뚫리면 여기서 깨진다. ──

  const ESCAPE_PROBES = [
    '금리가 오르면 주식엔 부담이 돼요',
    '금리 인상으로 인해 기술주가 내렸어요',
    '금리가 오른 날 주식은 대체로 내렸어요',
    '역사적으로 금리 인상기엔 주가가 약세였어요',
    '금리 하락은 주식시장에 호재로 여겨져요',
    '금리가 오르면 주가는 눌리곤 해요',
    '금리가 오르면 성장주에 불리해요',
    '금리가 내리면 주식에 유리해요',
    '금리 상승기엔 주가가 흔히 내렸어요',
  ];

  it.each(ESCAPE_PROBES)('위반 문형 "%s"는 금지 목록에 걸린다', probe => {
    expect(ALL_FORBIDDEN.some(p => probe.includes(p))).toBe(true);
  });
});
