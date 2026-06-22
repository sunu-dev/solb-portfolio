import { describe, it, expect } from 'vitest';
import { buildChartNarrative, type NarrativeInput, type BollingerPos } from '@/utils/chartNarrative';
import { getChartShapeSummary } from '@/utils/technical';
import {
  extractChartFeatures, classifyChartSituation, SITUATION_HEADLINES,
  type SituationInput, type SituationId,
} from '@/utils/situationEngine';
import type { TrendType, PatternResult } from '@/config/constants';

/**
 * §6 박제 — 분석 패널의 초보 차트 해설은 descriptive만. 처방(사/팔/고려)·한쪽 예측(오를 거/조정 옴)·
 * 추세 단정·행동 유도 토큰 금지. 정적 카피는 lint:alerts 사각이라 이 테스트가 회귀 그물.
 * chartNarrative(동적 생성)·situationEngine(상황 분류)·getChartShapeSummary(요약 카드) 모두 커버.
 *
 * 신규 위험어(미래개시 암시·매매 valence)는 situationEngine 헤드라인에 새로 안 들어가게 선제 차단.
 * 단 bare '돌파'는 getChartShapeSummary golden desc('위로 돌파한 상태')가 §6-안전하게 사용 중이라
 * 결합형('돌파 임박/돌파 기대')만 금지(완료형 '넘어선 자리'는 허용).
 */
const FORBIDDEN = [
  '사세요', '파세요', '매수를 고려', '매도를 고려', '분할 매수', '분할 매도',
  '이익 실현', '상승 추세', '하락 추세', '반등 가능', '조정이 올', '조정 주의',
  '단기 조정', '매수 관점', '매도 관점', '추천',
  '주의해주세요', '지켜보세요', '추세 진행', '추세 지속', '추세가 이어',
  // situationEngine 신규 차단 — 미래개시 암시·매매 valence
  '눌림목', '반등', '지지선 회복', '돌파 임박', '돌파 기대', '돌파할',
  '바닥 다지', '다지는 중', '상승 전환', '하락 전환', '저점 확인', '바닥 확인',
  '매수 기회', '상승 여력',
  // 적대 리뷰(2026-06-22) — 회복/상승 서사 가치동사 + 거래량 정서 라벨(매수 valence)
  '살아난', '받쳐 올라', '한 풀 꺾', '관심이 높은', '관심이 낮은', '관심이 몰리',
  // 의미 읽기 재calibration(2026-06-22 R2) — 저점대비% 서사 회귀 + 미래개시·기회 프레이밍 차단.
  // 단 관용적 현재상태 읽기('받치고 있고'·'약한 자리'·'한 발 처진'·'팽팽/눌린')는 SAFE라 미금지.
  '되살아', '바닥권', '저점권', '낙폭 과대', '되돌림', '회복 구간',
  '치솟', '바닥을 다', '식어가', '달아오르', '꺾이며', '받치며',
  '두 배 크게 올라', '많이 올라온', '두 배 넘게',
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

  it('요약은 일반론이 아니라 구체 분석(고점 기준 위치 + 평균선 의미)을 담고, raw 저점대비%는 안 쓴다', () => {
    // 고점·저점·평균선이 주어지면 위치 의미 + 평균선 해석이 나와야 함(일반론 회귀 방지).
    const { summary } = buildChartNarrative({ rsiVal: 45, bollingerPos: 'lower', price: 56, recentHigh: 72, recentLow: 27, sma20: 60, sma60: 50, volRatio: 1, level: 'basic' });
    expect(/내려와|대비|높았던/.test(summary)).toBe(true);  // 고점 기준 구체 위치
    expect(summary.includes('평균선')).toBe(true);          // 20/60일 평균선 포지션
    expect(summary).not.toContain('아무도');                // hedge 미사용
    // 파운더 지적('저점 26.59 대비 113% 올라온 자리'=무의미) 영구 폐기 박제
    expect(/저점 [\d.,]+ 대비/.test(summary)).toBe(false);
    expect(/\d+% 올라온/.test(summary)).toBe(false);
  });

  it('basic 레벨에선 볼린저 카드를 노출하지 않는다(차트-설명 일치)', () => {
    const basic = buildChartNarrative({ rsiVal: 72, bollingerPos: 'upper', price: 100, recentHigh: 130, recentLow: 70, sma20: 90, sma60: 80, volRatio: 2, level: 'basic' });
    expect(basic.cards.some(c => c.term === '볼린저밴드')).toBe(false);
    const detail = buildChartNarrative({ rsiVal: 72, bollingerPos: 'upper', price: 100, recentHigh: 130, recentLow: 70, sma20: 90, sma60: 80, volRatio: 2, level: 'detail' });
    expect(detail.cards.some(c => c.term === '볼린저밴드')).toBe(true);
  });
});

// ── situationEngine: 상황 분류 엔진 전 특징공간 박제 ──
const PATTERNS: (PatternResult | null)[] = [
  null,
  { name: '더블바텀 (W자형)', type: 'bullish', desc: '' },
  { name: '하락 쐐기형', type: 'potentially_bullish', desc: '' },
  { name: '하락 삼각형', type: 'bearish', desc: '' },
  { name: '상승 삼각형', type: 'bullish', desc: '' },
  { name: '횡보 (박스권)', type: 'neutral', desc: '' },
  { name: '상승 흐름', type: 'bullish', desc: '' },
  { name: '하락 흐름', type: 'bearish', desc: '' },
];
// price 고정 100, (sma20,sma60)로 maStack 전수, (recentHigh,recentLow)로 위치버킷 전수
const MA_COMBOS: [number | null, number | null][] = [[90, 80], [110, 120], [90, 120], [110, 80], [null, null]];
const POS_COMBOS: [number, number][] = [[130, 70], [105, 70], [130, 98], [100, 100]]; // mid / near_high / near_low / flat

function allSituationInputs(): SituationInput[] {
  const out: SituationInput[] = [];
  for (const closesLen of [10, 100]) {
    for (const [sma20, sma60] of MA_COMBOS) {
      for (const rsiVal of [15, 50, 85, null]) {
        for (const volRatio of [2, 1, 0.5]) {
          for (const cross of [null, 'golden', 'death'] as ('golden' | 'death' | null)[]) {
            for (const pattern of PATTERNS) {
              for (const [recentHigh, recentLow] of POS_COMBOS) {
                out.push({ closesLen, price: 100, sma20, sma60, rsiVal, volRatio, recentHigh, recentLow, cross, pattern });
              }
            }
          }
        }
      }
    }
  }
  return out;
}

const KNOWN_IDS = new Set(Object.keys(SITUATION_HEADLINES) as SituationId[]);

function situationText(input: SituationInput): string {
  const c = classifyChartSituation(extractChartFeatures(input));
  return [c.headline, c.reading, ...c.observations].filter(Boolean).join(' ');
}

describe('situationEngine — 차트 상황 분류 박제', () => {
  it('전 특징공간에서 헤드라인+의미읽기+보조관찰에 §6 토큰 0', () => {
    for (const input of allSituationInputs()) {
      const text = situationText(input);
      for (const tok of FORBIDDEN) {
        expect(text.includes(tok), `(${JSON.stringify(input)}): §6 토큰 "${tok}" — "${text}"`).toBe(false);
      }
    }
  });

  it('raw 저점대비% 영구 폐기 — 전 특징공간에서 "저점 N 대비"·"% 올라온" 0건', () => {
    for (const input of allSituationInputs()) {
      const text = situationText(input);
      expect(/저점 [\d.,]+ 대비/.test(text), `저점대비 회귀: "${text}"`).toBe(false);
      expect(/\d+% 올라온/.test(text), `% 올라온 회귀: "${text}"`).toBe(false);
    }
  });

  it('망라성·결정성 — 알려진 1상황 + 헤드라인·의미읽기 비어있지 않음 + 보조 ≤1 + 재호출 동일', () => {
    for (const input of allSituationInputs()) {
      const f = extractChartFeatures(input);
      const a = classifyChartSituation(f);
      const b = classifyChartSituation(f);
      expect(KNOWN_IDS.has(a.id), `미지 상황 id: ${a.id}`).toBe(true);
      expect(a.headline.length, `빈 헤드라인: ${a.id}`).toBeGreaterThan(0);
      if (a.id !== 'thin_data') expect(a.reading.length, `빈 의미읽기: ${a.id}`).toBeGreaterThan(0); // 메마름 방지
      expect(a.observations.length).toBeLessThanOrEqual(1); // 헤드라인+2문장 이내
      expect(b).toEqual(a); // 결정성
    }
  });

  it('우선순위 — 대표 입력이 의도한 상황으로만 매핑(겹침/회귀 방지)', () => {
    const base: SituationInput = { closesLen: 100, price: 100, sma20: 90, sma60: 80, rsiVal: 50, volRatio: 1, recentHigh: 130, recentLow: 70, cross: null, pattern: null };
    const id = (over: Partial<SituationInput>) => classifyChartSituation(extractChartFeatures({ ...base, ...over })).id;

    // Step0 데이터가드가 크로스보다 우선
    expect(id({ closesLen: 10, cross: 'golden' })).toBe('thin_data');
    expect(id({ recentHigh: 100, recentLow: 100, cross: 'golden' })).toBe('thin_data'); // flat
    // Step1 신선 크로스가 패턴·RSI보다 우선
    expect(id({ cross: 'golden', rsiVal: 85, recentHigh: 105, recentLow: 70, pattern: PATTERNS[1] })).toBe('fresh_golden_cross');
    expect(id({ cross: 'death' })).toBe('fresh_death_cross');
    // Step2 극단 RSI는 위치와 겹칠 때만 헤드라인 승격
    expect(id({ rsiVal: 85, recentHigh: 105, recentLow: 70 })).toBe('overheated_near_high'); // near_high
    expect(id({ rsiVal: 85, recentHigh: 130, recentLow: 98 })).not.toBe('overheated_near_high'); // 과열이나 저점부근 → 강등
    expect(id({ rsiVal: 15, sma20: 110, sma60: 120, recentHigh: 130, recentLow: 98 })).toBe('oversold_near_low');
    // Step3 패턴 명명 / 횡보→폴백 라우팅 / 단순추세→MA 위임
    expect(id({ pattern: PATTERNS[1] })).toBe('double_bottom_base');
    expect(id({ pattern: PATTERNS[5] })).toBe('sideways_box');     // 횡보(박스권)
    expect(id({ pattern: PATTERNS[6] })).toBe('above_both_ma');    // 상승 흐름은 MA스택으로 위임
    // Step4 MA 스택 4분기
    expect(id({})).toBe('above_both_ma');
    expect(id({ sma20: 110, sma60: 120 })).toBe('below_both_ma');
    expect(id({ sma20: 90, sma60: 120 })).toBe('recover_reclaim_20');
    expect(id({ sma20: 110, sma60: 80 })).toBe('cooling_lost_20');
  });

  it('하한(메마름 방지) — 파운더 케이스가 의미읽기+위치+고점기준을 담고 raw 저점대비는 0', () => {
    // 56.55, 26.59~72.07, 20일선 위·60일선 아래 → cooling_lost_20
    const c = classifyChartSituation(extractChartFeatures({ closesLen: 250, price: 56.55, sma20: 58, sma60: 54, rsiVal: 48, volRatio: 1, recentHigh: 72.07, recentLow: 26.59 }));
    const text = [c.headline, c.reading, ...c.observations].join(' ');
    expect(c.id).toBe('cooling_lost_20');
    expect(c.reading.length).toBeGreaterThan(0);
    expect(/처진|받치|약한|엇갈|팽팽|눌린|자리 잡은/.test(c.reading)).toBe(true); // 상태 의미 존재
    expect(/위쪽|가운데|아래쪽|고점 가까이|저점 가까이/.test(text)).toBe(true);    // 범위 내 위치
    expect(/내려와|높았던/.test(text)).toBe(true);                                  // 고점 기준 구체
    expect(/저점 [\d.,]+ 대비/.test(text)).toBe(false);                             // 저점대비 113% 없음
  });

  it('변동성 메타 — WIDE(폭≥80%)면 "움직임이 큰 종목" 부착, NARROW면 미부착', () => {
    const wide = classifyChartSituation(extractChartFeatures({ closesLen: 250, price: 100, sma20: 110, sma60: 120, rsiVal: 45, volRatio: 1, recentHigh: 200, recentLow: 90 }));
    expect([wide.headline, wide.reading, ...wide.observations].join(' ')).toContain('움직임이 큰 종목');
    const narrow = classifyChartSituation(extractChartFeatures({ closesLen: 250, price: 100, sma20: 110, sma60: 120, rsiVal: 45, volRatio: 1, recentHigh: 110, recentLow: 100 }));
    expect([narrow.headline, narrow.reading, ...narrow.observations].join(' ')).not.toContain('움직임이 큰 종목');
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
