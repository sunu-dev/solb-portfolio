import { describe, it, expect } from 'vitest';
import * as macroCopy from '@/config/macroContextCopy';
import {
  CPI_EDU_CARD,
  JP_RATE_EDU_CARD,
  MACRO_CARD_HEADER,
  type MacroEduCopy,
} from '@/config/macroContextCopy';
import { FORBIDDEN_PHRASES } from '@/utils/alertCompliance';
import {
  findMacroCopyViolations,
  GLOBAL_FORECAST_FORBIDDEN,
  MACRO_DIRECTION_TERMS,
  MACRO_PERSONALIZATION_FORBIDDEN,
  MACRO_PRODUCT_TERMS,
} from '../../scripts/macro-copy-policy.mjs';

/**
 * §6 — 시장 맥락 교육 카피 누출 불변식.
 *
 * 이 카피는 사용자에게 정적으로 렌더된다(AI 게이트 미경유). lint와 테스트가
 * 같은 정책 모듈을 호출해 목록 불일치 사각을 없애고, 실제 카피 구조와 검출력
 * 프로브를 함께 박제한다.
 */

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, acc));
  return acc;
}

const ALL_COPY_STRINGS = collectStrings(macroCopy);
const ALL_TEXT = ALL_COPY_STRINGS.join(' ');

const EDU_CARDS: ReadonlyArray<readonly [string, MacroEduCopy]> = Object.entries(macroCopy)
  .filter(([name]) => name.endsWith('_EDU_CARD'))
  .map(([name, card]) => [name, card as MacroEduCopy] as const);

function policyViolationCount(text: string): number {
  const macroCount = findMacroCopyViolations(text).length;
  const forecastCount = GLOBAL_FORECAST_FORBIDDEN.filter(phrase => text.includes(phrase)).length;
  return macroCount + forecastCount;
}

describe('§6 — 시장 맥락 교육 카피 (모듈 전체)', () => {
  it('5개 교육 카드의 문자열 카피를 수집한다', () => {
    expect(EDU_CARDS).toHaveLength(5);
    expect(ALL_TEXT.length).toBeGreaterThan(100);
  });

  it('공용 매크로 정책을 모든 개별 문자열이 통과한다', () => {
    const hits = ALL_COPY_STRINGS.flatMap(text => findMacroCopyViolations(text));
    expect(hits).toEqual([]);
  });

  it.each(GLOBAL_FORECAST_FORBIDDEN)('미래 단정 어휘 "%s"를 포함하지 않는다', phrase => {
    expect(ALL_TEXT.includes(phrase)).toBe(false);
  });

  it('전역 알림 금지 어휘도 통과한다', () => {
    expect(FORBIDDEN_PHRASES.filter(phrase => ALL_TEXT.includes(phrase))).toEqual([]);
  });

  it.each(MACRO_PERSONALIZATION_FORBIDDEN)('개인화 토큰 "%s"가 0건이다', phrase => {
    expect(ALL_TEXT.includes(phrase)).toBe(false);
  });

  it.each(EDU_CARDS)('%s — mechanics와 limits가 각각 1~2개다', (_name, card) => {
    expect(card.mechanics.length).toBeGreaterThanOrEqual(1);
    expect(card.mechanics.length).toBeLessThanOrEqual(2);
    expect(card.mechanics.every(sentence => sentence.trim().length > 0)).toBe(true);
    expect(card.limits.length).toBeGreaterThanOrEqual(1);
    expect(card.limits.length).toBeLessThanOrEqual(2);
    expect(card.limits.every(sentence => sentence.trim().length > 0)).toBe(true);
  });

  it.each(EDU_CARDS)('%s — 양방향 서술(내린/오른 병기)', (_name, card) => {
    expect(card.bothWays).toMatch(/내린 (날|적)도/);
    expect(card.bothWays).toMatch(/오른 (날|적)도/);
  });

  it.each(EDU_CARDS)('%s — 미래 봉인("아무도"+"참고")', (_name, card) => {
    expect(card.unknowable).toContain('아무도');
    expect(card.unknowable).toContain('참고');
  });

  it('일본 카드는 엔캐리 규모가 아닌 실현금리임을 dataNote에 명시한다', () => {
    expect(JP_RATE_EDU_CARD.dataNote).toContain('엔캐리 규모가 아니라');
    expect(JP_RATE_EDU_CARD.dataNote).toContain('실현금리');
  });

  it('CPI 카드는 상승률 둔화와 가격 하락의 차이를 설명한다', () => {
    expect(CPI_EDU_CARD.limits.join(' ')).toMatch(/상승률 둔화.*가격 하락/);
  });

  it('공용 고지에 출처와 비권유가 있다', () => {
    expect(MACRO_CARD_HEADER.footnote).toContain('미국 재무부');
    expect(MACRO_CARD_HEADER.footnote).toContain('권유하지 않');
  });

  const DANGEROUS_PROBES = [
    // 2026-08-19 적대 재감사에서 기존 목록을 탈출했던 문형
    '금리가 오르면 주식엔 부담이 돼요.',
    '금리 인상으로 인해 기술주가 내렸어요.',
    '금리가 오른 날 주식은 대체로 내렸어요.',
    '역사적으로 금리 인상기엔 주가가 약세였어요.',
    '금리 하락은 주식시장에 호재로 여겨져요.',
    '금리가 오르면 주가는 눌리곤 해요.',
    '금리가 오르면 성장주에 불리해요.',
    '금리가 내리면 주식에 유리해요.',
    '금리 상승기엔 주가가 흔히 내렸어요.',
    // 2026-08-20 심화 가드: 개인화·행동·조건·확률·예상 비교
    '회원님의 보유 종목 비중을 확인해요.',
    '발표 전에 대비하세요.',
    '금리가 높아질수록 반도체가 피해를 봐요.',
    '물가가 둔화하면 기술주가 수혜를 봐요.',
    '가능성이 커진 신호로 볼 수 있어요.',
    '이 징후는 방향을 시사해요.',
    '예상보다 높아 컨센서스 서프라이즈예요.',
    // 활용형 어간 회귀: 흔히 내리만 찾으면 내렸어요를 놓쳤던 전례를 박제
    '주가는 흔히 내려요.',
    '주가는 흔히 내렸어요.',
    '주가는 흔히 내리면 반응해요.',
  ] as const;

  it.each(DANGEROUS_PROBES)('위험 문장 "%s"는 공용 정책에 걸린다', probe => {
    expect(policyViolationCount(probe)).toBeGreaterThan(0);
  });

  const SAFE_PROBES = [
    '가치평가에서 먼 미래 이익이 차지하는 몫이 클수록 할인율 가정 변화에 계산 결과가 더 달라져요.',
    '상승률 둔화는 가격 하락과 다른 뜻이에요. 가격이 오르는 속도가 느려졌다는 뜻이에요.',
    '엔캐리는 금리가 낮은 엔화로 자금을 마련해 다른 통화 자산에 운용하는 거래를 뜻해요.',
    '이 값은 엔캐리 규모가 아니라 시장에서 형성된 실현금리예요.',
    // 상품명과 방향어가 서로 다른 문장이라 결합 판정하지 않아야 한다.
    '코스닥을 설명해요. 다른 지표가 약해졌어요.',
  ] as const;

  it.each(SAFE_PROBES)('안전 문장 "%s"는 공용 정책을 통과한다', probe => {
    expect(policyViolationCount(probe)).toBe(0);
  });

  it.each(MACRO_PRODUCT_TERMS.flatMap(product => (
    MACRO_DIRECTION_TERMS.map(direction => [product, direction] as const)
  )))('같은 문장의 상품×방향 결합 "%s×%s"을 탐지한다', (product, direction) => {
    const hits = findMacroCopyViolations(`${product}는 ${direction} 흐름이에요.`);
    expect(hits.some(hit => hit.kind === 'product-direction')).toBe(true);
  });

  it('상품명과 방향어가 다른 문장이면 근접 결합으로 보지 않는다', () => {
    const hits = findMacroCopyViolations('코스피를 설명해요. 다른 지표가 약해졌어요.');
    expect(hits.some(hit => hit.kind === 'product-direction')).toBe(false);
  });
});
