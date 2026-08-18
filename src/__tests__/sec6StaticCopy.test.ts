import { describe, it, expect } from 'vitest';
import { PRESET_EVENTS } from '@/config/constants';
import { FORBIDDEN_PHRASES, SAFE_REPLACEMENTS, sanitizeAiOutput } from '@/utils/alertCompliance';

/**
 * §6 정적 카피 누출 불변식 — 2026-08-18 전수 감사 후속.
 *
 * 배경: `scripts/lint-alerts.mjs`의 미래 단정 검사가 오랫동안 `/morning-brief|digest/`
 * 경로에만 적용돼 있었다. 그 사이 `src/config/constants.ts`의 PRESET_EVENTS insight가
 * "강하게 반등할 가능성이 높아요" · "분할 매수 전략이 효과적" 같은 문구를
 * '초보자를 위한 해석'이라는 권위 프레이밍으로 렌더했는데도 lint는 계속 초록불이었다.
 * 심지어 한 건은 `// lint-alerts-ignore` pragma로 게이트를 명시적으로 우회했다.
 *
 * lint를 전역으로 승격했지만, lint는 '문자열 리터럴이 소스에 있는지'만 본다.
 * 이 테스트는 **실제 export 되는 값**을 검사해 조립·보간으로 우회하는 회귀까지 잡는다.
 * (chartNarrative.test.ts와 같은 역할.)
 */

/** 앞일을 단정하거나 확률을 주장하는 표현 */
const FORECAST_FORBIDDEN = [
  '오를 것', '내릴 것', '상승할 것', '하락할 것', '급등할', '급락할',
  '반등할', '반등이 기대', '반등을 기대',
  '가능성이 높', '가능성이 큽', '확률이 높',
  '기대됩니다', '기대되지만', '기대돼요',
  '전망됩니다', '예상됩니다', '예상돼요',
];

/** 특정 매매 전략을 권하거나 효과를 보증하는 표현 */
const STRATEGY_FORBIDDEN = [
  '효과적이었', '유효한 전략', '매수 타이밍', '매도 타이밍',
  '분할 매수 기회', '분할 매수 전략',
  '매수하세요', '매도하세요', '수익 실현을', '손절하세요',
];

/** 사용자 보유 내역을 근거 없이 단정하는 표현 */
const HOLDING_CLAIM_FORBIDDEN = ['보유 종목은', '할인된 상태'];

describe('§6 — PRESET_EVENTS 이벤트 해설 카피', () => {
  it('모든 이벤트에 insight가 있고 비어 있지 않다', () => {
    expect(PRESET_EVENTS.length).toBeGreaterThan(0);
    for (const ev of PRESET_EVENTS) {
      expect(typeof ev.insight, `${ev.id}`).toBe('string');
      expect(ev.insight.trim().length, `${ev.id}`).toBeGreaterThan(0);
    }
  });

  it.each(FORECAST_FORBIDDEN)('미래 단정 "%s"를 포함하지 않는다', phrase => {
    const hits = PRESET_EVENTS.filter(ev => ev.insight.includes(phrase)).map(ev => ev.id);
    expect(hits, `PRESET_EVENTS insight에 "${phrase}" 누출`).toEqual([]);
  });

  it.each(STRATEGY_FORBIDDEN)('매매 전략 권유 "%s"를 포함하지 않는다', phrase => {
    const hits = PRESET_EVENTS.filter(ev => ev.insight.includes(phrase)).map(ev => ev.id);
    expect(hits, `PRESET_EVENTS insight에 "${phrase}" 누출`).toEqual([]);
  });

  it.each(HOLDING_CLAIM_FORBIDDEN)('보유 내역 단정 "%s"를 포함하지 않는다', phrase => {
    const hits = PRESET_EVENTS.filter(ev => ev.insight.includes(phrase)).map(ev => ev.id);
    expect(hits, `PRESET_EVENTS insight에 "${phrase}" 누출`).toEqual([]);
  });

  it('전역 FORBIDDEN_PHRASES도 통과한다', () => {
    for (const ev of PRESET_EVENTS) {
      const hits = FORBIDDEN_PHRASES.filter(p => ev.insight.includes(p));
      expect(hits, `${ev.id}`).toEqual([]);
    }
  });
});

describe('§6 — sanitizeAiOutput은 조용히 통과시키지 않는다', () => {
  /**
   * 핵심 회귀 방어.
   *
   * 예전 구현은 `SAFE_REPLACEMENTS[phrase] ?? phrase.replace(/매수|매도|사야|팔아야/g,'관찰')`였다.
   * 매핑도 없고 저 4개 토큰도 없는 문구는 `safe === phrase`가 되어 치환이 no-op인데도
   * `replaced.push(phrase)`가 실행됐다. 그 결과 '당신에게 추천'·'맞춤 추천'·'인기 종목'·
   * '비중을 줄이세요'·'물타기' 같은 유사투자자문 신호 어휘가 **원문 그대로 나가면서
   * 로그에는 정화된 것처럼** 남았다.
   *
   * 이 테스트는 FORBIDDEN_PHRASES 전체를 순회하므로, 앞으로 안전 대체어 없는 문구를
   * 추가해도 자동으로 커버된다.
   */
  it.each(FORBIDDEN_PHRASES)('"%s"를 손대지 않고 통과시키지 않는다', phrase => {
    const input = `이번 분기 실적은 양호해요. ${phrase} 라고 합니다. 참고만 해주세요.`;
    const { text, replaced } = sanitizeAiOutput(input);

    // 핵심 불변식: 금지 어휘가 들어오면 출력은 **반드시 원문과 달라야** 한다.
    // 예전 no-op 버그는 정확히 이 조건을 어기면서 replaced에는 기록을 남겼다.
    expect(text, `"${phrase}"가 원문 그대로 통과`).not.toBe(input);
    expect(replaced, `"${phrase}"가 기록되지 않음`).toContain(phrase);

    // 안전 대체어가 있는 경우, 대체어 자체가 원문구를 품을 수 있다
    // (예: '2배 수익' → '2배 수익 가능성(2배 손실 가능성도 동일)' — 위험 고지를 붙인 균형 표현).
    // 그런 경우는 '치환이 일어났는지'까지만 확인하고, 그 외에는 문구가 사라져야 한다.
    const mapped = SAFE_REPLACEMENTS[phrase];
    if (mapped === undefined || !mapped.includes(phrase)) {
      expect(text, `"${phrase}"가 출력에 잔존`).not.toContain(phrase);
    } else {
      expect(text).toContain(mapped);
    }
  });

  it('안전 대체어가 있으면 교체하고, 없으면 문장을 드롭한다', () => {
    const mapped = FORBIDDEN_PHRASES.find(p => SAFE_REPLACEMENTS[p] !== undefined);
    const unmapped = FORBIDDEN_PHRASES.find(
      p => SAFE_REPLACEMENTS[p] === undefined && p.replace(/매수|매도|사야|팔아야/g, '관찰') === p,
    );
    expect(mapped, '매핑된 문구 표본이 있어야 한다').toBeDefined();
    expect(unmapped, '매핑 없는 문구 표본이 있어야 한다').toBeDefined();

    const a = sanitizeAiOutput(`앞 문장. ${mapped} 입니다. 뒤 문장.`);
    expect(a.text).toContain('앞 문장');
    expect(a.replaced).toContain(mapped);
    expect(a.dropped).not.toContain(mapped);

    const b = sanitizeAiOutput(`앞 문장. ${unmapped} 입니다. 뒤 문장.`);
    expect(b.text).not.toContain(unmapped);
    expect(b.text).toContain('앞 문장');   // 위반 문장만 제거, 나머지는 보존
    expect(b.dropped).toContain(unmapped);
  });

  it('위반이 없으면 원문을 그대로 둔다', () => {
    const clean = '오늘 종가는 어제보다 2.1% 낮았어요. 앞으로의 방향은 아무도 알 수 없어요.';
    const { text, replaced, dropped } = sanitizeAiOutput(clean);
    expect(text).toBe(clean);
    expect(replaced).toEqual([]);
    expect(dropped).toEqual([]);
  });

  it('문장 경계가 없는 짧은 라벨은 전체를 비운다', () => {
    const unmapped = FORBIDDEN_PHRASES.find(
      p => SAFE_REPLACEMENTS[p] === undefined && p.replace(/매수|매도|사야|팔아야/g, '관찰') === p,
    )!;
    const { text } = sanitizeAiOutput(unmapped);
    expect(text).toBe('');
  });
});
