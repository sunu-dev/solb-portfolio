import { describe, it, expect } from 'vitest';
import { buildChartNarrative, type NarrativeInput, type BollingerPos } from '@/utils/chartNarrative';
import { getChartShapeSummary } from '@/utils/technical';
import type { TrendType } from '@/config/constants';

/**
 * §6 박제 — 차트 해설 '여정 요약'은 descriptive + 정보 안내만. 처방(사/팔/고려)·한쪽 예측(오를 거/조정 옴)·
 * 추세 단정·매매 valence·미래개시 암시·정서 라벨 금지. 정적 카피는 lint:alerts 사각이라 이 테스트가 회귀 그물.
 * buildChartNarrative(여정 요약 + 용어 카드)·getChartShapeSummary(요약 카드) 커버.
 */
const FORBIDDEN = [
  '사세요', '파세요', '매수를 고려', '매도를 고려', '분할 매수', '분할 매도',
  '이익 실현', '상승 추세', '하락 추세', '반등 가능', '조정이 올', '조정 주의',
  '단기 조정', '매수 관점', '매도 관점', '추천',
  '주의해주세요', '지켜보세요', '추세 진행', '추세 지속', '추세가 이어',
  // 미래개시 암시·매매 valence
  '눌림목', '반등', '지지선 회복', '돌파 임박', '돌파 기대', '돌파할',
  '바닥 다지', '다지는 중', '상승 전환', '하락 전환', '저점 확인', '바닥 확인',
  '매수 기회', '상승 여력',
  // 회복/상승 서사 가치동사 + 거래량/감정 정서 라벨
  '살아난', '받쳐 올라', '한 풀 꺾', '관심이 높은', '관심이 낮은', '관심이 몰리',
  '되살아', '바닥권', '저점권', '낙폭 과대', '되돌림', '회복 구간',
  '치솟', '바닥을 다', '식어가', '달아오르', '꺾이며', '받치며',
  '두 배 크게 올라', '많이 올라온', '두 배 넘게',
  '주춤', '힘이 빠진', '지친', '탄탄한', '숨 고르', '쉬어 가',
  // 여정 전환 §6 변호사 권고(2026-06-22 R5) — 조언/기회 프레이밍 선제 차단
  '유망', '적기', '기회', '지금이 적',
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
            for (const hasNews of [true, false]) {
              for (const periodLabel of ['최근 한 달', '최근 석 달', '최근 1년', undefined]) {
                for (const [recentHigh, recentLow, price] of [[130, 70, 100], [200, 90, 195], [130, 70, 72], [100, 100, 100]] as [number, number, number][]) {
                  out.push({ rsiVal, bollingerPos, price, recentHigh, recentLow, sma20: above ? 90 : 110, sma60: above ? 80 : 120, volRatio, level, hasNews, periodLabel });
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

describe('chartNarrative 여정 요약 — §6 누출 박제', () => {
  it('모든 입력 조합에서 처방·예측·valence 토큰 0', () => {
    for (const input of allNarrativeInputs()) {
      const text = narrativeText(input);
      for (const tok of FORBIDDEN) {
        expect(text.includes(tok), `입력 ${JSON.stringify(input)} 출력에 §6 토큰 "${tok}"`).toBe(false);
      }
    }
  });

  it('raw 저점대비% 폐기 — 전 조합에서 "저점 N 대비"·"% 올라온" 0건', () => {
    for (const input of allNarrativeInputs()) {
      const { summary } = buildChartNarrative(input);
      expect(/저점 [\d.,]+ 대비/.test(summary), `저점대비 회귀: "${summary}"`).toBe(false);
      expect(/\d+% 올라온/.test(summary), `% 올라온 회귀: "${summary}"`).toBe(false);
    }
  });

  it('여정 요약은 저점~고점 여정 + 고점 대비 위치 + 기간을 담는다(일반론 회귀 방지)', () => {
    const { summary } = buildChartNarrative({ rsiVal: 45, bollingerPos: 'lower', price: 56, recentHigh: 72, recentLow: 27, sma20: 60, sma60: 50, volRatio: 1, level: 'basic', periodLabel: '최근 석 달', hasNews: true });
    expect(summary.includes('최근 석 달')).toBe(true);          // 여정 기간
    expect(summary.includes('가장 낮을 땐')).toBe(true);        // 저점
    expect(summary.includes('가장 높을 땐')).toBe(true);        // 고점
    expect(summary.includes('제일 비쌌을 때보다')).toBe(true);  // 고점 대비 위치
    expect(/\d+%쯤 내려온/.test(summary)).toBe(true);           // 구체 % (일반론 아님)
    expect(summary).not.toContain('아무도');                    // hedge 미사용
  });

  it('관련 뉴스 안내는 hasNews일 때만 부착', () => {
    const base = { rsiVal: 45, bollingerPos: 'lower' as BollingerPos, price: 56, recentHigh: 72, recentLow: 27, sma20: 60, sma60: 50, volRatio: 1, level: 'basic' as const, periodLabel: '최근 석 달' };
    expect(buildChartNarrative({ ...base, hasNews: true }).summary.includes('관련 뉴스')).toBe(true);
    expect(buildChartNarrative({ ...base, hasNews: false }).summary.includes('관련 뉴스')).toBe(false);
  });

  it('변동성 성격 — 폭 큰 종목엔 "오르내림이 큰", 좁으면 미부착', () => {
    const wide = buildChartNarrative({ rsiVal: 50, bollingerPos: null, price: 150, recentHigh: 200, recentLow: 90, sma20: 140, sma60: 130, volRatio: 1, level: 'basic', periodLabel: '최근 1년' });
    expect(wide.summary.includes('오르내림이 큰')).toBe(true);  // (200-90)/90 = 122% ≥ 80
    const narrow = buildChartNarrative({ rsiVal: 50, bollingerPos: null, price: 105, recentHigh: 110, recentLow: 100, sma20: 104, sma60: 103, volRatio: 1, level: 'basic', periodLabel: '최근 1년' });
    expect(narrow.summary.includes('오르내림이 큰')).toBe(false); // 10% < 80
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
