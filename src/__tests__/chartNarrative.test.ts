import { describe, it, expect } from 'vitest';
import { buildChartNarrative, type NarrativeInput, type BollingerPos } from '@/utils/chartNarrative';
import { getChartShapeSummary } from '@/utils/technical';
import type { TrendType } from '@/config/constants';

/**
 * §6 박제 — 분석 패널의 초보 차트 해설은 descriptive만. 처방(사/팔/고려)·한쪽 예측(오를 거/조정 옴)·
 * 추세 단정·행동 유도 토큰 금지. 정적 카피는 lint:alerts 사각이라 이 테스트가 회귀 그물.
 * chartNarrative(동적 생성)와 getChartShapeSummary(차트 요약 카드, 라이브 렌더) 둘 다 커버.
 */
const FORBIDDEN = [
  '사세요', '파세요', '매수를 고려', '매도를 고려', '분할 매수', '분할 매도',
  '이익 실현', '상승 추세', '하락 추세', '반등 가능', '조정이 올', '조정 주의',
  '단기 조정', '매수 관점', '매도 관점', '추천',
  '주의해주세요', '지켜보세요', '추세 진행', '추세 지속', '추세가 이어',
];

function narrativeText(input: NarrativeInput): string {
  const n = buildChartNarrative(input);
  return [n.summary, ...n.cards.flatMap(c => [c.whatIsIt, c.nowMeans])].join(' ');
}

function allNarrativeInputs(): NarrativeInput[] {
  const out: NarrativeInput[] = [];
  for (const rsiVal of [15, 50, 85, null]) {
    for (const bollingerPos of ['upper', 'lower', 'middle', null] as (BollingerPos | null)[]) {
      for (const above of [true, false]) {
        for (const volRatio of [2, 0.5, 1]) {
          for (const level of ['basic', 'detail'] as const) {
            for (const [recentHigh, recentLow, price] of [[130, 70, 100], [130, 70, 128], [130, 70, 72], [100, 100, 100]] as [number, number, number][]) {
              out.push({ rsiVal, bollingerPos, price, recentHigh, recentLow, sma20: above ? 90 : 110, sma60: above ? 80 : 120, volRatio, level });
            }
          }
        }
      }
    }
  }
  return out;
}

describe('chartNarrative — §6 누출 박제', () => {
  it('모든 입력 조합에서 처방·한쪽예측 토큰 0', () => {
    for (const input of allNarrativeInputs()) {
      const text = narrativeText(input);
      for (const tok of FORBIDDEN) {
        expect(text.includes(tok), `입력 ${JSON.stringify(input)} 출력에 §6 토큰 "${tok}"`).toBe(false);
      }
    }
  });

  it('요약은 항상 균형/참고 표현을 포함(앞일 한쪽 단정 아님)', () => {
    for (const input of allNarrativeInputs()) {
      const { summary } = buildChartNarrative(input);
      expect(summary.includes('아무도') || summary.includes('참고')).toBe(true);
    }
  });

  it('basic 레벨에선 볼린저 카드를 노출하지 않는다(차트-설명 일치)', () => {
    const basic = buildChartNarrative({ rsiVal: 72, bollingerPos: 'upper', price: 100, recentHigh: 130, recentLow: 70, sma20: 90, sma60: 80, volRatio: 2, level: 'basic' });
    expect(basic.cards.some(c => c.term === '볼린저밴드')).toBe(false);
    const detail = buildChartNarrative({ rsiVal: 72, bollingerPos: 'upper', price: 100, recentHigh: 130, recentLow: 70, sma20: 90, sma60: 80, volRatio: 2, level: 'detail' });
    expect(detail.cards.some(c => c.term === '볼린저밴드')).toBe(true);
  });
});

describe('getChartShapeSummary — §6 누출 박제 (차트 요약 카드)', () => {
  it('모든 trend×cross×rsi 조합에서 처방·예측·추세단정 토큰 0', () => {
    const trends: TrendType[] = ['strong_up', 'up', 'strong_down', 'down', 'sideways'] as TrendType[];
    const crosses: (string | null)[] = [null, 'golden', 'death'];
    const rsis = [[15], [50], [85]];
    for (const trend of trends) {
      for (const cross of crosses) {
        for (const rsi of rsis) {
          const r = getChartShapeSummary(trend, null, rsi, cross);
          const text = `${r.title} ${r.desc}`;
          for (const tok of FORBIDDEN) {
            expect(text.includes(tok), `${trend}/${cross}/RSI${rsi[0]}: §6 토큰 "${tok}" — "${text}"`).toBe(false);
          }
        }
      }
    }
  });
});
