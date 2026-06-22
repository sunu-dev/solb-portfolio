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
  dropFromHigh: number | null; // 표시 구간 고점 대비 하락 %(직관적 — 출력 유지)
  riseFromLow: number | null;  // 표시 구간 저점 대비 상승 %(분모가 화면 좌측끝 우연값 → 직관 0, 출력 안 함·후방호환만)
  rangeWidthPct: number | null;// (고점-저점)/저점 — 변동성 메타용(WIDE면 '크게 오르내린')
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
  headline: string;   // 어떤 상황인가
  reading: string;    // 그래서 지금 어떤 상태인가(관용적 현재상태 해석, §6 안전) — thin_data는 ''
  observations: string[]; // 보조 사실 1개(범위 내 위치·변동성·거래량)
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
// THRESHOLDS.md #56 — 표시 구간 변동폭 WIDE(저점 대비 고점이 +80%↑면 '크게 오르내린 종목')
const RANGE_WIDE = 80;

/** 범위 내 위치 버킷 → 사람 말 위치어(raw 저점대비% 대신 '어디쯤'을 의미로). '~에 있고/있어요'로 연결돼 조사 무관. */
const RANGE_PLACE_WORD: Record<PricePosBucket, string> = {
  near_high: '고점 가까이',  // 실사용은 obsRangePos near_high 분기
  upper: '위쪽',
  mid: '가운데쯤',
  lower: '아래쪽',
  near_low: '저점 가까이',
};

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
    pricePos = { bucket: 'mid', posInRange01: 0.5, dropFromHigh: null, riseFromLow: null, rangeWidthPct: null };
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
      rangeWidthPct: i.recentLow > 0 ? Math.round(((i.recentHigh - i.recentLow) / i.recentLow) * 100) : null,
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
  // '단기' 수식어 제거 — '단기적으로 곧 조정' 예측 뉘앙스 차단, 기존 RSI 칩 표준어('과열/과매도 구간')와 일치
  overheated_near_high: (f) =>
    `RSI ${f.rsiVal != null ? Math.round(f.rsiVal) : ''}로 70을 넘은 과열 구간이고, 가격도 표시 구간 고점 가까이에 있어요.`,
  oversold_near_low: (f) =>
    `RSI ${f.rsiVal != null ? Math.round(f.rsiVal) : ''}로 30을 밑도는 과매도 구간이고, 가격도 표시 구간 저점 가까이에 있어요.`,
  double_bottom_base: () => '바닥을 두 번 비슷한 높이로 찍은, 흔히 "더블바텀"이라 부르는 모양이에요.',
  // 거울쌍 대칭 + 가치동사 제거(받쳐 올라온/멈칫/꼭 오르는 건 아니에요) — 순수 기하 서술
  falling_wedge_slowing: () => '내려오긴 했지만 내리는 폭이 점점 줄어드는 모양이에요("하락 쐐기형"이라 불러요).',
  descending_triangle: () => '고점은 점점 낮아지는데 저점은 비슷한 높이에 모여 있는 모양이에요.',
  ascending_triangle: () => '저점은 점점 높아지는데 고점은 비슷한 높이에 모여 있는 모양이에요.',
  // 가치동사(올라온 흐름/살아난/한 풀 꺾인) 제거 → 평균선 대비 위치 사실만(이동평균선 카드 SSOT 표현 계승)
  above_both_ma: () => '현재가가 20일·60일 평균선보다 모두 위에 있는 자리예요.',
  below_both_ma: (f) =>
    f.pricePos.dropFromHigh != null
      ? `최근 고점 ${fmt(f.recentHigh)} 대비 ${f.pricePos.dropFromHigh}% 내려와, 현재가가 20일·60일 평균선보다 모두 아래에 있는 자리예요.`
      : '현재가가 20일·60일 평균선보다 모두 아래에 있는 자리예요.',
  recover_reclaim_20: () => '현재가가 20일 평균선보다 위, 60일 평균선보다 아래에 있는 자리예요.',
  cooling_lost_20: () => '현재가가 60일 평균선보다 위, 20일 평균선보다 아래에 있는 자리예요.',
  sideways_box: () => '뚜렷한 방향 없이 일정 범위에서 오르내리는, 흔히 "박스권"이라 부르는 모양이에요.',
};

/** MA 스택의 관용 현재상태 읽기(단기=20일/중기=60일). 크로스·패턴 상황의 'reading'으로 재사용. */
function maStackReading(f: ChartFeatures): string {
  switch (f.maStack) {
    case 'above_both': return '단기·중기 어느 기준으로 봐도 평균 위에 있는 상태예요.';
    case 'below_both': return '단기·중기 어느 기준으로 봐도 평균 아래에 있는 상태예요.';
    case 'below20_above60': return '중기 기준은 평균 위, 단기 기준은 평균 아래인 상태예요.';
    case 'above20_below60': return '단기 기준은 평균 위, 중기 기준은 평균 아래인 상태예요.';
    default: return '';
  }
}

/**
 * 상황별 '의미 읽기' 1줄 — "어디 있나"에 "그래서 지금 어떤 상태인가"를 더한다.
 * 전부 시간정지 상태형용(받치고 있고/한 발 처진/팽팽한/약한)만 — 미래시제·valence·hedge 0.
 * §6 SAFE 관용적 현재상태 해석('20일선 아래=단기 약함' 등급, feedback_descriptive_not_prescriptive).
 * 헤드라인과 격리(정적 카피 lint 사각 방지). thin_data는 빈 문자열.
 */
export const SITUATION_READINGS: Record<SituationId, (f: ChartFeatures) => string> = {
  thin_data: () => '',
  fresh_golden_cross: maStackReading,
  fresh_death_cross: maStackReading,
  overheated_near_high: () => '양쪽(RSI·가격) 다 위로 치우쳐 팽팽한 구간이에요.',
  oversold_near_low: () => '양쪽(RSI·가격) 다 아래로 치우쳐 눌린 구간이에요.',
  double_bottom_base: maStackReading,
  falling_wedge_slowing: maStackReading,
  descending_triangle: maStackReading,
  ascending_triangle: maStackReading,
  above_both_ma: () => '단기·중기 어느 쪽으로 봐도 평균 위에 자리 잡은 상태예요.',
  below_both_ma: () => '단기·중기 어느 쪽으로 봐도 평균 아래에 있는 약한 자리예요.',
  recover_reclaim_20: () => '최근 한 달(20일)은 평균 위로 올라섰지만, 더 긴 흐름(60일)은 아직 평균 아래인 엇갈린 자리예요.',
  cooling_lost_20: () => '더 긴 흐름(60일)은 평균 위, 최근 한 달(20일)은 평균 아래라, 큰 흐름은 받치고 단기는 한 발 처진 상태예요.',
  sideways_box: () => '일정 폭 안에 머무는 상태예요.',
};

// ── 보조관찰 조각(전부 §6-안전 현재상태 서술). 한 상황당 1개. ──
/**
 * 범위 내 '어디쯤' 읽기 — raw 저점대비%(직관 0) 폐기, 위치어 + 직관적 고점대비% 합성.
 * @param withHigh 헤드라인이 이미 고점대비를 말하면 false(중복 방지) → 위치어만.
 */
function obsRangePos(f: ChartFeatures, withHigh: boolean): string | null {
  // '(현재 X)' 괄호 raw 제거 — 현재가는 화면 최상단에 이미 있어 잉여(해설은 숫자를 '읽기' 아닌 '풀기').
  if (f.dataQuality === 'flat') return null;
  const place = RANGE_PLACE_WORD[f.pricePos.bucket];
  if (f.pricePos.bucket === 'near_high') {
    return '표시된 구간 안에서 보면 고점 가까이에 있어요.';
  }
  if (withHigh && f.pricePos.dropFromHigh != null) {
    return `표시된 구간 안에서 보면 ${place}에 있고, 가장 높았던 ${fmt(f.recentHigh)}보다 ${f.pricePos.dropFromHigh}% 내려와 있는 자리예요.`;
  }
  return `표시된 구간 안에서 보면 ${place}에 있어요.`;
}
/** 변동성 메타 — WIDE면 raw 저점/고점 나열 대신 '움직임이 큰 종목' 성격으로 해석(양방향·valence 0). */
function obsVolatility(f: ChartFeatures): string | null {
  if (f.dataQuality === 'flat' || f.pricePos.rangeWidthPct == null || f.pricePos.rangeWidthPct < RANGE_WIDE) return null;
  return '이 종목은 표시 구간에서 가격이 꽤 크게 출렁인, 움직임이 큰 종목이에요.';
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

/**
 * 보조 사실 1개만(헤드라인+reading 뒤). '헤드라인+2문장 이내' 보장 위해 정확히 ≤1개.
 * - RSI 극단: 헤드라인이 위치·reading이 팽팽/눌린 → 거래량 강도만
 * - below_both: 헤드라인이 이미 고점대비 → 변동성(WIDE) 또는 위치어만(중복 회피)
 * - 그 외: 범위 내 위치 + 직관적 고점대비%(저점대비 raw% 영구 폐기)
 */
function pickObservations(id: SituationId, f: ChartFeatures): string[] {
  // RSI 극단: 헤드라인(RSI+위치)+reading(팽팽/눌린)으로 이미 완결 → 보조 없음(거래량 사족 제거)
  if (id === 'thin_data' || id === 'overheated_near_high' || id === 'oversold_near_low') return [];
  // below_both: 헤드라인이 이미 고점대비 → 변동성(WIDE) 또는 위치어만(중복 회피)
  const obs = id === 'below_both_ma'
    ? (obsVolatility(f) ?? obsRangePos(f, false))
    : obsRangePos(f, true);
  return obs ? [obs] : [];
}

/** 차트 상황 1개 분류 + 헤드라인 + 의미읽기 + 보조 사실. 순수·결정적. */
export function classifyChartSituation(f: ChartFeatures): ClassifiedSituation {
  const id = pickSituationId(f);
  const headline = SITUATION_HEADLINES[id](f);
  const reading = SITUATION_READINGS[id](f);
  const observations = pickObservations(id, f);
  return { id, headline, reading, observations };
}
