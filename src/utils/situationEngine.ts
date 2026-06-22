/**
 * 차트 상황 분류 엔진 SSOT — "이 차트, 지금 어떤 상황인가"를 하나의 이야기로.
 *
 * 설계(2026-06-22 설계회의): 조각 나열 대신
 *   ① 가용 지표(가격/20·60일선/RSI/거래량/패턴/크로스)를 정규 ChartFeatures로 추출(신규 계산 0)
 *   ② 우선순위 결정트리(첫 매치=1상황)로 13개 정규 상황 중 1개 선택
 *   ③ 상황별 큐레이트 헤드라인 1줄 + 보조관찰 1~2개(헤드라인이 안 쓴 축만)
 * 전부 순수·결정적 → 모든 차트를 빠짐없이(폴백 포함) 커버. 조합 폭발 없음.
 *
 * §6 안전 불변식(자본시장법 — 매매 방향 0):
 * - 모든 헤드라인·보조관찰은 '~자리예요/~모양이에요/~흐름이에요/~구간이에요' 명사형 현재상태 종결.
 * - 미래시제·의지·권유·미래개시 암시('시작/임박/전환/다지기/확인/여력/반등/눌림목/돌파 기대') 0.
 * - 객관 사실·모양 명명까지만(골든크로스·더블바텀), 그로 인한 미래 해석 부가 금지.
 * - '추세' 단어 미사용('올라온 흐름/내려온 흐름/오르내리는 모양'으로만 — 기존 FORBIDDEN 등재어).
 * - 개별 보유(수량/평단)는 입력에 절대 넣지 않음 — 차트 자체의 객관 상태 거울만.
 * src/__tests__/chartNarrative.test.ts 가 전 특징공간에서 금지 토큰 0·결정성·망라성을 박제.
 */
import type { PatternResult } from '@/config/constants';

export type MaStack = 'above_both' | 'above20_below60' | 'below20_above60' | 'below_both' | null;
export type RsiZone = 'hot' | 'cold' | 'neutral' | null;
export type VolState = 'surge' | 'quiet' | 'normal';
export type PricePosBucket = 'near_high' | 'upper' | 'mid' | 'lower' | 'near_low';
export type DataQuality = 'thin' | 'flat' | 'full';

export type SituationId =
  | 'thin_data'
  | 'fresh_golden_cross' | 'fresh_death_cross'
  | 'overheated_near_high' | 'oversold_near_low'
  | 'double_bottom_base' | 'falling_wedge_slowing' | 'descending_triangle' | 'ascending_triangle'
  | 'above_both_ma' | 'below_both_ma' | 'recover_reclaim_20' | 'cooling_lost_20'
  | 'sideways_box';

export interface PricePos {
  bucket: PricePosBucket;
  posInRange01: number;        // 표시 구간 내 0(저점)~1(고점) 위치
  dropFromHigh: number | null; // 표시 구간 고점 대비 하락 %
  riseFromLow: number | null;  // 표시 구간 저점 대비 상승 %
}

export interface ChartFeatures {
  price: number;
  maStack: MaStack;
  pricePos: PricePos;
  rsiZone: RsiZone;
  rsiVal: number | null;
  vol: VolState;
  pattern: PatternResult | null;
  cross: 'golden' | 'death' | null;
  dataQuality: DataQuality;
  recentHigh: number;
  recentLow: number;
}

/** AnalysisPanel.analysis가 이미 보유한 값만 입력 — 신규 계산 0. */
export interface SituationInput {
  closesLen?: number;             // thin 판정용(있으면)
  price: number;
  sma20: number | null;           // 마지막 값
  sma60: number | null;           // 마지막 값
  rsiVal: number | null;
  volRatio: number;
  recentHigh: number;             // 표시 구간 고점/저점 (chartRange 종속 — 의도된 동작)
  recentLow: number;
  cross?: 'golden' | 'death' | null;
  pattern?: PatternResult | null;
}

export interface ClassifiedSituation {
  id: SituationId;
  headline: string;
  observations: string[];
}

// THRESHOLDS.md #52~55 — 표시 구간 내 위치 버킷(🎯 경험, 텔레메트리 후 재검증 P1)
const POS_NEAR_HIGH = 0.85;
const POS_UPPER = 0.6;
const POS_LOWER = 0.4;
const POS_NEAR_LOW = 0.15;
// RSI 70/30(#38 표준)·거래량 1.5/0.6(기존 chartNarrative 임계)는 기존 SSOT 재사용
const RSI_HOT = 70;
const RSI_COLD = 30;
const VOL_SURGE = 1.5;
const VOL_QUIET = 0.6;

/** 숫자 포맷 — 1000↑ 천단위, 100↑ 정수, 그 외 소수 2자리(기존 chartNarrative와 동일). */
const fmt = (n: number): string => (n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(n >= 100 ? 0 : 2));

/**
 * 가용 지표 → 정규 ChartFeatures. 순수·결정적, 0분모/NaN 전부 가드.
 * 입력 동일 = 출력 동일.
 */
export function extractChartFeatures(i: SituationInput): ChartFeatures {
  // 데이터 품질 — 패턴/극단 단정을 차단할 thin/flat을 최상위에서 판정
  const thin = (i.closesLen != null && i.closesLen <= 20) || i.sma60 == null || i.sma20 == null;
  const flat = !(i.recentHigh > i.recentLow); // NaN·동일가 포함(0분모 회피)
  const dataQuality: DataQuality = thin ? 'thin' : flat ? 'flat' : 'full';

  // MA 스택 — 현재가 vs 20·60일선 (둘 다 있을 때만)
  let maStack: MaStack = null;
  if (i.sma20 != null && i.sma60 != null) {
    const a20 = i.price >= i.sma20;
    const a60 = i.price >= i.sma60;
    maStack = a20 && a60 ? 'above_both' : a20 ? 'above20_below60' : a60 ? 'below20_above60' : 'below_both';
  }

  // 표시 구간 내 위치 — flat이면 중앙 고정
  let pricePos: PricePos;
  if (flat) {
    pricePos = { bucket: 'mid', posInRange01: 0.5, dropFromHigh: null, riseFromLow: null };
  } else {
    const pos = (i.price - i.recentLow) / (i.recentHigh - i.recentLow);
    const bucket: PricePosBucket =
      pos >= POS_NEAR_HIGH ? 'near_high'
      : pos <= POS_NEAR_LOW ? 'near_low'
      : pos >= POS_UPPER ? 'upper'
      : pos <= POS_LOWER ? 'lower'
      : 'mid';
    pricePos = {
      bucket,
      posInRange01: pos,
      dropFromHigh: i.recentHigh > 0 ? Math.round(((i.recentHigh - i.price) / i.recentHigh) * 100) : null,
      riseFromLow: i.recentLow > 0 ? Math.round(((i.price - i.recentLow) / i.recentLow) * 100) : null,
    };
  }

  const rsiZone: RsiZone =
    i.rsiVal == null ? null : i.rsiVal > RSI_HOT ? 'hot' : i.rsiVal < RSI_COLD ? 'cold' : 'neutral';
  const vol: VolState = i.volRatio > VOL_SURGE ? 'surge' : i.volRatio < VOL_QUIET ? 'quiet' : 'normal';

  return {
    price: i.price,
    maStack,
    pricePos,
    rsiZone,
    rsiVal: i.rsiVal,
    vol,
    pattern: i.pattern ?? null,
    cross: i.cross ?? null,
    dataQuality,
    recentHigh: i.recentHigh,
    recentLow: i.recentLow,
  };
}

/**
 * 상황별 큐레이트 헤드라인(§6-안전, 한 곳 격리 = 정적 카피 lint 사각 방지).
 * 전부 명사형 현재상태 종결, 미래/처방/추세 단정 0.
 */
export const SITUATION_HEADLINES: Record<SituationId, (f: ChartFeatures) => string> = {
  thin_data: () => '아직 거래된 날이 적어 차트 모양을 읽기엔 정보가 부족한 종목이에요.',
  fresh_golden_cross: () => '짧은 평균선이 긴 평균선을 막 위로 넘어선 자리예요(흔히 "골든크로스"라고 부르는 모양이에요).',
  fresh_death_cross: () => '짧은 평균선이 긴 평균선을 막 아래로 지난 자리예요(흔히 "데드크로스"라고 부르는 모양이에요).',
  overheated_near_high: (f) =>
    `RSI ${f.rsiVal != null ? Math.round(f.rsiVal) : ''}로 70을 넘어 최근 단기 과열 구간이고, 가격도 표시 구간 고점 가까이에 있어요.`,
  oversold_near_low: (f) =>
    `RSI ${f.rsiVal != null ? Math.round(f.rsiVal) : ''}로 30 아래로 최근 단기 과매도 구간이고, 가격도 표시 구간 저점 가까이에 있어요.`,
  double_bottom_base: () => '바닥을 두 번 비슷한 높이로 찍은, 흔히 "더블바텀"이라 부르는 모양이에요.',
  falling_wedge_slowing: () =>
    '내려오긴 했지만 내리는 폭이 점점 줄며 멈칫하는 모양이에요("하락 쐐기형"이라 불러요). 이런 모양이라고 꼭 다시 오르는 건 아니에요.',
  descending_triangle: () => '고점은 낮아지는데 저점은 비슷하게 눌려 있는 모양이에요.',
  ascending_triangle: () => '저점이 점점 높아지며 받쳐 올라온 모양이에요.',
  above_both_ma: () => '20일·60일 평균선을 모두 위에 둔, 최근 올라온 흐름이에요.',
  below_both_ma: (f) =>
    f.pricePos.dropFromHigh != null
      ? `최근 고점 ${fmt(f.recentHigh)} 대비 ${f.pricePos.dropFromHigh}% 내려와, 20일·60일 평균선을 모두 아래에 둔 자리예요.`
      : '20일·60일 평균선을 모두 아래에 둔 자리예요.',
  recover_reclaim_20: () => '60일 평균선 아래에서 20일 평균선 위로는 올라선, 단기 흐름이 살아난 자리예요.',
  cooling_lost_20: () => '60일 평균선은 지키지만 20일 평균선은 아래로 내준, 단기 흐름이 한 풀 꺾인 자리예요.',
  sideways_box: () => '뚜렷한 방향 없이 일정 범위에서 오르내리는, 흔히 "박스권"이라 부르는 모양이에요.',
};

// ── 보조관찰 조각(전부 §6-안전 현재상태 서술). 헤드라인이 안 쓴 축만 골라 붙임. ──
function obsHighLow(f: ChartFeatures): string | null {
  if (f.pricePos.dropFromHigh == null || f.pricePos.riseFromLow == null) return null;
  return `최근 고점 ${fmt(f.recentHigh)} 대비 ${f.pricePos.dropFromHigh}% 내려왔고, 저점 ${fmt(f.recentLow)} 대비로는 ${f.pricePos.riseFromLow}% 올라온 자리예요(현재 ${fmt(f.price)}).`;
}
function obsMaStack(f: ChartFeatures): string | null {
  switch (f.maStack) {
    case 'above_both': return '20일·60일 평균선을 모두 위에 둔 자리예요.';
    case 'below_both': return '20일·60일 평균선을 모두 아래에 둔 자리예요.';
    case 'below20_above60': return '60일 평균선은 지키지만 20일 평균선은 아래인 자리예요.';
    case 'above20_below60': return '60일 평균선 아래에서 20일 평균선 위인 자리예요.';
    default: return null;
  }
}
function obsRsi(f: ChartFeatures): string | null {
  if (f.rsiZone === 'hot') return 'RSI는 70 위로 최근 단기 과열 구간이에요.';
  if (f.rsiZone === 'cold') return 'RSI는 30 아래로 최근 단기 과매도 구간이에요.';
  return null;
}
function obsVol(f: ChartFeatures): string | null {
  if (f.vol === 'surge') return '거래량은 평소보다 늘어 최근 관심이 높은 편이에요.';
  if (f.vol === 'quiet') return '거래량은 평소보다 줄어 조용한 편이에요.';
  return null;
}

/** 우선순위 결정트리 — 위→아래 첫 매치 1상황. 모든 입력이 정확히 1개로 매핑(폴백 포함). */
function pickSituationId(f: ChartFeatures): SituationId {
  // Step0 데이터 가드 — thin/flat이면 패턴·극단 단정 차단
  if (f.dataQuality === 'thin' || f.dataQuality === 'flat') return 'thin_data';
  // Step1 신선 크로스(시의성 최강) — detectCross가 직전 1봉 교차만 보므로 non-null = 오늘 막 발생
  if (f.cross === 'golden') return 'fresh_golden_cross';
  if (f.cross === 'death') return 'fresh_death_cross';
  // Step2 극단 RSI × 위치 결합(겹칠 때만 헤드라인 승격, 어긋나면 보조관찰로 강등)
  if (f.rsiZone === 'hot' && (f.pricePos.bucket === 'near_high' || f.pricePos.bucket === 'upper')) return 'overheated_near_high';
  if (f.rsiZone === 'cold' && (f.pricePos.bucket === 'near_low' || f.pricePos.bucket === 'lower')) return 'oversold_near_low';
  // Step3 패턴 명명(thin/flat은 Step0에서 이미 제외)
  if (f.pattern) {
    if (f.pattern.name === '더블바텀 (W자형)') return 'double_bottom_base';
    if (f.pattern.type === 'potentially_bullish') return 'falling_wedge_slowing';
    if (f.pattern.name === '하락 삼각형') return 'descending_triangle';
    if (f.pattern.name === '상승 삼각형') return 'ascending_triangle';
    if (f.pattern.name === '횡보 (박스권)') return 'sideways_box';
    // '상승 흐름'/'하락 흐름'(단순 추세)은 MA스택으로 위임 — MA가 더 정밀
  }
  // Step4 MA 스택
  switch (f.maStack) {
    case 'above_both': return 'above_both_ma';
    case 'below_both': return 'below_both_ma';
    case 'above20_below60': return 'recover_reclaim_20';
    case 'below20_above60': return 'cooling_lost_20';
  }
  // Step5 폴백 — maStack null 등 모든 잔여 흡수(항상 도달 = exhaustive)
  return 'sideways_box';
}

/** 헤드라인이 쓰지 않은 축에서 가장 두드러진 보조관찰 1~2개(중복 금지). */
function pickObservations(id: SituationId, f: ChartFeatures): string[] {
  if (id === 'thin_data') return [];

  const out: (string | null)[] = [];
  const crossOrPattern =
    id === 'fresh_golden_cross' || id === 'fresh_death_cross' ||
    id === 'double_bottom_base' || id === 'falling_wedge_slowing' ||
    id === 'descending_triangle' || id === 'ascending_triangle' ||
    id === 'sideways_box';
  const rsiHeadline = id === 'overheated_near_high' || id === 'oversold_near_low';

  if (crossOrPattern) {
    // 헤드라인=모양/크로스 → 위치(MA스택) + 강도(RSI 또는 거래량)
    out.push(obsMaStack(f));
    out.push(obsRsi(f) ?? obsVol(f));
  } else if (rsiHeadline) {
    // 헤드라인=RSI 극단 → 고점/저점 대비 % + 거래량
    out.push(obsHighLow(f));
    out.push(obsVol(f));
  } else {
    // 헤드라인=MA 스택 → 고점/저점 대비 %(below_both는 헤드라인이 이미 하락% 언급=중복 제외) + RSI/거래량
    if (id !== 'below_both_ma') out.push(obsHighLow(f));
    out.push(obsRsi(f) ?? obsVol(f));
  }
  return out.filter((x): x is string => !!x).slice(0, 2);
}

/** 차트 상황 1개 분류 + 헤드라인 + 보조관찰. 순수·결정적. */
export function classifyChartSituation(f: ChartFeatures): ClassifiedSituation {
  const id = pickSituationId(f);
  const headline = SITUATION_HEADLINES[id](f);
  const observations = pickObservations(id, f);
  return { id, headline, observations };
}
