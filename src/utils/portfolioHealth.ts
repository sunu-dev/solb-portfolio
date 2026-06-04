import { STOCK_KR } from '@/config/constants';

// 섹터 분류 (심볼 기반 간이 분류). export: 누출 불변식 테스트가 '이 모듈이 인지하는 티커'
// 전체를 스캔 사전에 포함시키기 위함(STOCK_KR에 없는 ABBV/COP/KO/PEP 등 사각지대 차단).
export const SECTOR_MAP: Record<string, string> = {
  NVDA: 'IT', AMD: 'IT', INTC: 'IT', MU: 'IT', AVGO: 'IT', QCOM: 'IT', TSM: 'IT',
  AAPL: 'IT', MSFT: 'IT', GOOG: 'IT', GOOGL: 'IT', META: 'IT', AMZN: '소비재',
  TSLA: '자동차', NFLX: '미디어', DIS: '미디어',
  JPM: '금융', V: '금융', MA: '금융', BAC: '금융', GS: '금융',
  JNJ: '헬스케어', UNH: '헬스케어', PFE: '헬스케어', ABBV: '헬스케어', LLY: '헬스케어',
  XOM: '에너지', CVX: '에너지', COP: '에너지', NEE: '에너지', DUK: '에너지', SO: '에너지',
  KO: '소비재', PEP: '소비재', PG: '소비재', WMT: '소비재', COST: '소비재',
  // 갭 진단 한·미 공통 섹터 공정성 위해 미국 대표 티커 보강(소재·산업재·통신)
  LIN: '소재', SHW: '소재', FCX: '소재', DOW: '소재', APD: '소재', NUE: '소재',
  CAT: '산업재', BA: '산업재', GE: '산업재', HON: '산업재', UPS: '산업재', UNP: '산업재', LMT: '산업재', RTX: '산업재', DE: '산업재', MMM: '산업재',
  T: '통신', VZ: '통신', TMUS: '통신',
};

/**
 * 한국 종목 섹터 매핑 — KOREAN_UNIVERSE(KOSPI70+KOSDAQ30) 기준. SECTOR_MAP과 동일 taxonomy.
 * 미등록 한국 종목은 getSector에서 '한국주식'(catch-all)으로 폴백 → classifiable 가드가 갭 단정 회피.
 * ⚠️ 객관 분류만(대표 사업 기준). 추천·선호 의미 없음(방향0).
 */
export const KR_SECTOR_MAP: Record<string, string> = {
  // IT (반도체·전자·인터넷·SW)
  '005930.KS': 'IT', '000660.KS': 'IT', '035420.KS': 'IT', '035720.KS': 'IT',
  '009150.KS': 'IT', '011070.KS': 'IT', '042700.KS': 'IT', '034220.KS': 'IT', '402340.KS': 'IT',
  '058470.KQ': 'IT', '039030.KQ': 'IT', '067310.KQ': 'IT', '240810.KQ': 'IT', '095340.KQ': 'IT', '108860.KQ': 'IT',
  // 금융
  '105560.KS': '금융', '055550.KS': '금융', '138040.KS': '금융', '032830.KS': '금융', '323410.KS': '금융',
  '086790.KS': '금융', '316140.KS': '금융', '377300.KS': '금융', '000810.KS': '금융', '006800.KS': '금융',
  '005940.KS': '금융', '024110.KS': '금융',
  // 헬스케어 (제약·바이오·의료)
  '207940.KS': '헬스케어', '068270.KS': '헬스케어', '326030.KS': '헬스케어', '128940.KS': '헬스케어',
  '196170.KQ': '헬스케어', '028300.KQ': '헬스케어', '214150.KQ': '헬스케어', '145020.KQ': '헬스케어',
  '048410.KQ': '헬스케어', '086900.KQ': '헬스케어', '328130.KQ': '헬스케어', '000250.KQ': '헬스케어',
  // 자동차 (완성차·부품)
  '005380.KS': '자동차', '000270.KS': '자동차', '012330.KS': '자동차', '018880.KS': '자동차', '161390.KS': '자동차',
  // 소비재 (음식료·화장품·유통·생활)
  '033780.KS': '소비재', '021240.KS': '소비재', '051900.KS': '소비재', '097950.KS': '소비재', '090430.KS': '소비재',
  '004370.KS': '소비재', '007310.KS': '소비재', '004990.KS': '소비재', '023530.KS': '소비재', '139480.KS': '소비재',
  '034230.KQ': '소비재', '950140.KQ': '소비재',
  // 미디어 (게임·엔터·콘텐츠)
  '259960.KS': '미디어', '036570.KS': '미디어', '352820.KS': '미디어',
  '293490.KQ': '미디어', '263750.KQ': '미디어', '035900.KQ': '미디어', '041510.KQ': '미디어', '122870.KQ': '미디어',
  '112040.KQ': '미디어', '078340.KQ': '미디어', '194480.KQ': '미디어', '067160.KQ': '미디어',
  // 에너지 (정유·전력·가스)
  '015760.KS': '에너지', '096770.KS': '에너지', '036460.KS': '에너지',
  // 소재 (화학·철강·비철·2차전지)
  '373220.KS': '소재', '006400.KS': '소재', '005490.KS': '소재', '051910.KS': '소재', '009830.KS': '소재', '010130.KS': '소재',
  '247540.KQ': '소재', '086520.KQ': '소재', '278280.KQ': '소재', '357780.KQ': '소재',
  // 산업재 (중공업·조선·건설·방산·기계·운송)
  '028260.KS': '산업재', '012450.KS': '산업재', '011200.KS': '산업재', '034020.KS': '산업재', '329180.KS': '산업재',
  '241560.KS': '산업재', '006360.KS': '산업재', '000880.KS': '산업재', '010140.KS': '산업재', '000120.KS': '산업재',
  '047810.KS': '산업재', '000720.KS': '산업재', '000150.KS': '산업재', '003490.KS': '산업재',
  // 통신
  '030200.KS': '통신', '017670.KS': '통신',
  // 지주/복합 — 단일 산업 단정 곤란 → '기타'(classifiable 가드가 갭 단정 회피)
  '034730.KS': '기타', '003550.KS': '기타', '078930.KS': '기타', '900140.KQ': '기타',
};

export function getSector(symbol: string): string {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return KR_SECTOR_MAP[symbol] || '한국주식';
  return SECTOR_MAP[symbol] || '기타';
}

/**
 * 분산 '갭 진단'용 산업 카테고리 후보.
 * '기타'(미분류)·'한국주식'(시장 단위 catch-all)은 제외 — 특정 종목을 지목하지 않고
 * '아직 없는 산업 카테고리'만 거울처럼 비추기 위함(방향0·자본시장법 §6 준수선).
 * ⚠️ 여기에 절대 티커/종목명을 넣지 말 것(추천으로 미끄러짐). 추상 섹터명만.
 */
export const DIVERSIFIABLE_SECTORS = ['IT', '금융', '헬스케어', '소비재', '에너지', '자동차', '미디어', '소재', '산업재', '통신'] as const;

export interface HealthStock {
  symbol: string;
  avgCost: number;
  shares: number;
  targetReturn: number;
  currentPrice: number;
  value: number;
}

export interface MetricResult {
  score: number;
  detail: string;
  color: string;
}

/**
 * 섹터 갭 진단 — '추천' 아닌 'descriptive 거울'. 사용자 현재 상태(보유 섹터)와
 * 비어있는 산업 카테고리만 노출하고, 특정 종목은 절대 지목하지 않는다.
 */
export interface SectorBreakdown {
  present: string[];      // 보유 섹터 (가중치 내림차순)
  topSector: string;      // 최대 비중 섹터
  topSectorPct: number;   // 0~100 정수
  absent: string[];       // DIVERSIFIABLE_SECTORS 중 미보유 산업
  classifiable: boolean;  // 미분류('기타'+'한국주식') 비중 < 0.5 → 갭 진단 신뢰 가능
}

export interface HealthResult {
  total: number;
  concentration: MetricResult;
  diversification: MetricResult;
  goalSetting: MetricResult;
  profitBalance: MetricResult;
  sectorBreakdown: SectorBreakdown;
}

/**
 * 포트폴리오 건강 점수 (0~100, HHI 기반 재설계)
 *
 * 4축 점수:
 * - 집중도 (30점) — HHI(Herfindahl-Hirschman Index) Σ(w_i)²
 *     0.18↓ 양호, 0.25 주의, 0.40↑ 위험. effective N = 1/HHI 표시
 * - 섹터 분산 (25점) — Effective Sectors = 1/Σ(w_sector)² (가중치 반영)
 *     ≥4 만점, 1 미만 0점. 단순 카운트 대비 IT 95% / 헬스 5% 같은 가짜 분산 잡아냄
 * - 목표 설정 (25점) — 설정율 ×15 + 달성율 ×10
 *     "설정만"과 "달성까지" 구분
 * - 손익 밸런스 (20점) — 승률 ×12 + W/L Ratio ×8
 *     평균 이익/평균 손실 비율(Profit Factor 변형)으로 손실 규모 반영
 *     "5개 +1% / 5개 -50%" vs "5개 +30% / 5개 -1%"를 다르게 평가
 */
export function calcHealthScore(stocks: HealthStock[]): HealthResult {
  const idleColor = 'var(--text-tertiary, #B0B8C1)';
  if (stocks.length === 0) {
    return {
      total: 0,
      concentration:  { score: 0, detail: '종목 없음', color: idleColor },
      diversification:{ score: 0, detail: '종목 없음', color: idleColor },
      goalSetting:    { score: 0, detail: '종목 없음', color: idleColor },
      profitBalance:  { score: 0, detail: '종목 없음', color: idleColor },
      sectorBreakdown: { present: [], topSector: '', topSectorPct: 0, absent: [], classifiable: false },
    };
  }

  const totalValue = stocks.reduce((s, st) => s + st.value, 0);
  const weightsDecimal = stocks.map(s => totalValue > 0 ? s.value / totalValue : 0);

  // ─── 1. 집중도 — HHI 기반 ────────────────────────────────────────
  const hhi = weightsDecimal.reduce((s, w) => s + w * w, 0);
  const effectiveN = hhi > 0 ? 1 / hhi : 0;
  const maxWeight = Math.max(...weightsDecimal) * 100;
  const topIdx = weightsDecimal.indexOf(Math.max(...weightsDecimal));
  const topSymbol = stocks[topIdx]?.symbol || '';
  const topName = STOCK_KR[topSymbol] || topSymbol;

  // 점수: HHI 0~0.18 양호(30), 0.18~0.25 주의(30→22), 0.25~0.40 위험(22→10), 0.40+ 매우위험(10→0)
  let concScore: number;
  if (hhi <= 0.18) concScore = 30;
  else if (hhi <= 0.25) concScore = Math.round(30 - (hhi - 0.18) / 0.07 * 8);
  else if (hhi <= 0.40) concScore = Math.round(22 - (hhi - 0.25) / 0.15 * 12);
  else concScore = Math.round(Math.max(0, 10 - (hhi - 0.40) / 0.10 * 10));

  let concDetail: string;
  if (hhi <= 0.18) {
    concDetail = `효과 분산 ${effectiveN.toFixed(1)}개 (HHI ${hhi.toFixed(2)})`;
  } else if (hhi <= 0.25) {
    concDetail = `${topName} ${maxWeight.toFixed(0)}% — 약간 집중 (효과 ${effectiveN.toFixed(1)}개)`;
  } else if (hhi <= 0.40) {
    concDetail = `${topName} ${maxWeight.toFixed(0)}% — 분산 필요 (효과 ${effectiveN.toFixed(1)}개)`;
  } else {
    concDetail = `${topName} ${maxWeight.toFixed(0)}% — 집중 위험`;
  }

  // ─── 2. 섹터 분산 — Effective Sectors ───────────────────────────
  const sectorWeights: Record<string, number> = {};
  weightsDecimal.forEach((w, i) => {
    const sector = getSector(stocks[i].symbol);
    sectorWeights[sector] = (sectorWeights[sector] || 0) + w;
  });
  const sectorList = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1]);
  const sectorHhi = Object.values(sectorWeights).reduce((s, w) => s + w * w, 0);
  const effectiveSectors = sectorHhi > 0 ? 1 / sectorHhi : 0;
  const sectorCount = sectorList.length;

  // 점수: effectiveSectors ≥4 만점, ≤1 0점, 사이는 선형
  const divScore = Math.round(Math.max(0, Math.min(25, (effectiveSectors - 1) / 3 * 25)));

  const topSectorName = sectorList[0]?.[0] || '기타';
  const topSectorPct = (sectorList[0]?.[1] || 0) * 100;
  let divDetail: string;
  if (effectiveSectors >= 3.5) {
    divDetail = `${effectiveSectors.toFixed(1)}개 섹터 효과 분산`;
  } else if (effectiveSectors >= 2) {
    divDetail = `${sectorCount}개 섹터 (효과 ${effectiveSectors.toFixed(1)}, ${topSectorName} ${topSectorPct.toFixed(0)}%)`;
  } else if (effectiveSectors >= 1.3) {
    divDetail = `${topSectorName}에 ${topSectorPct.toFixed(0)}% — 분산 부족`;
  } else {
    divDetail = `${topSectorName} 섹터에만 집중`;
  }

  // 섹터 갭 진단용 분해 — '추천' 아닌 descriptive. 미분류('기타'+'한국주식') 비중이 조금이라도
  // 유의미하면 SECTOR_MAP(미국 티커 중심)으로 '빈 산업'을 단정 불가(그 안에 해당 산업이 숨어 있을 수
  // 있음 — 예: 삼성전자=한국 IT인데 '한국주식'으로 뭉뚱그려짐). 그래서 임계를 0.15로 보수화:
  // 보유의 85%+ 가 분류 가능한 미국 섹터일 때만 '빈 산업' 단정. 아니면 일반 안내로 폴백(거울 정확성 보존).
  const unknownWeight = (sectorWeights['기타'] || 0) + (sectorWeights['한국주식'] || 0);
  const sectorBreakdown: SectorBreakdown = {
    present: sectorList.map(([name]) => name),
    topSector: topSectorName,
    topSectorPct: Math.round(topSectorPct),
    absent: DIVERSIFIABLE_SECTORS.filter(s => !(sectorWeights[s] > 0)),
    classifiable: unknownWeight < 0.15,
  };

  // ─── 3. 목표 설정 — 설정 + 달성 분리 ────────────────────────────
  const total = stocks.length;
  const withGoal = stocks.filter(s => s.targetReturn > 0).length;
  const achieved = stocks.filter(s => {
    if (s.targetReturn <= 0 || s.avgCost <= 0) return false;
    const pnlPct = ((s.currentPrice - s.avgCost) / s.avgCost) * 100;
    return pnlPct >= s.targetReturn;
  }).length;

  const setRate = withGoal / total;
  const achievedRate = achieved / total;
  const goalScore = Math.round(setRate * 15 + achievedRate * 10);

  let goalDetail: string;
  if (setRate === 1 && achieved > 0) {
    goalDetail = `${total}개 모두 설정 · ${achieved}개 달성`;
  } else if (setRate === 1) {
    goalDetail = `${total}개 모두 설정 · 달성 대기`;
  } else if (withGoal === 0) {
    goalDetail = `목표 미설정 — 종목별 목표를 정해보세요`;
  } else {
    goalDetail = `${total}개 중 ${withGoal}개 설정 · ${achieved}개 달성`;
  }

  // ─── 4. 손익 밸런스 — 승률 + W/L Ratio ──────────────────────────
  const validStocks = stocks.filter(s => s.avgCost > 0 && s.currentPrice > 0);
  let balScore = 0;
  let balDetail = '';

  if (validStocks.length === 0) {
    balDetail = '평단 정보 없음';
  } else if (validStocks.length === 1) {
    // 단일 종목은 승률만으로 평가 (W/L Ratio 무의미)
    const s = validStocks[0];
    const pnl = (s.currentPrice - s.avgCost) / s.avgCost * 100;
    balScore = pnl > 0 ? 12 : pnl < 0 ? 4 : 8;
    balDetail = `1개 종목 — 표본 부족 (${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%)`;
  } else {
    let winCount = 0;
    let gainCount = 0;
    let lossCount = 0;
    let totalGainMag = 0;
    let totalLossMag = 0;

    validStocks.forEach(s => {
      const pnl = (s.currentPrice - s.avgCost) / s.avgCost * 100;
      if (pnl > 0) { winCount++; gainCount++; totalGainMag += pnl; }
      else if (pnl < 0) { lossCount++; totalLossMag += Math.abs(pnl); }
    });

    const winRate = winCount / validStocks.length;
    const avgGain = gainCount > 0 ? totalGainMag / gainCount : 0;
    const avgLoss = lossCount > 0 ? totalLossMag / lossCount : 0;
    // W/L Ratio: 평균 이익 / 평균 손실. 손실 없으면 큰 값(2.0 cap)
    const wlRatio = avgLoss > 0 ? avgGain / avgLoss : (avgGain > 0 ? 2.0 : 1.0);

    // 점수: 승률 ×12 + W/L Ratio 점수 ×8
    // wlRatio 0.5→0점, 1.0→4점, 2.0→8점
    const winScore = winRate * 12;
    const wlScore = Math.max(0, Math.min(8, (wlRatio - 0.5) / 1.5 * 8));
    balScore = Math.round(winScore + wlScore);

    if (avgLoss === 0) {
      balDetail = `승률 ${Math.round(winRate * 100)}% · 손실 종목 없음`;
    } else if (avgGain === 0) {
      balDetail = `승률 0% · 평균 손실 ${avgLoss.toFixed(0)}%`;
    } else {
      balDetail = `승률 ${Math.round(winRate * 100)}% · 평균 ${wlRatio.toFixed(1)}x (이익 ${avgGain.toFixed(0)}% / 손실 ${avgLoss.toFixed(0)}%)`;
    }
  }

  const finalTotal = concScore + divScore + goalScore + balScore;

  const scoreColor = (s: number, max: number) => {
    const ratio = s / max;
    if (ratio >= 0.8) return 'var(--color-success, #16A34A)';
    if (ratio >= 0.5) return 'var(--color-warning, #FF9500)';
    return 'var(--color-danger, #EF4452)';
  };

  return {
    total: finalTotal,
    concentration:  { score: concScore, detail: concDetail, color: scoreColor(concScore, 30) },
    diversification:{ score: divScore,  detail: divDetail,  color: scoreColor(divScore, 25) },
    goalSetting:    { score: goalScore, detail: goalDetail, color: scoreColor(goalScore, 25) },
    profitBalance:  { score: balScore,  detail: balDetail,  color: scoreColor(balScore, 20) },
    sectorBreakdown,
  };
}

/** 총점에 따른 라벨 */
export function getHealthLabel(total: number): string {
  if (total >= 80) return '건강';
  if (total >= 60) return '양호';
  if (total >= 40) return '주의';
  return '위험';
}

/** 총점에 따른 색상 */
export function getHealthColor(total: number): string {
  if (total >= 80) return 'var(--color-success, #16A34A)';
  if (total >= 60) return 'var(--color-info, #3182F6)';
  if (total >= 40) return 'var(--color-warning, #FF9500)';
  return 'var(--color-danger, #EF4452)';
}

// ==========================================
// NEXT ACTION RECOMMENDATION
// ==========================================
//
// docs/ALGORITHM_REVIEW.md §4 (결정적 결함 #3 대응)
// 사용자가 점수만 보고 끝나지 않게, "5점 더 올리려면 X" 액션 1개 제시.

export interface HealthAction {
  axis: 'concentration' | 'diversification' | 'goalSetting' | 'profitBalance';
  title: string;      // "+5점 더 올리려면" 같은 헤드라인
  action: string;     // 구체 실행 안내 (1문장)
  emoji: string;
  impact: number;     // 기대 점수 상승 (0~max)
}

/**
 * 가장 큰 약점 축을 찾아 액션 1개 추천.
 * 4축 점수/만점 비율 최저인 축이 타깃.
 * 모든 축이 80%+ 이상이면 null (이미 충분히 양호).
 */
export function recommendNextAction(result: HealthResult): HealthAction | null {
  const axes = [
    { key: 'concentration' as const, m: result.concentration, max: 30 },
    { key: 'diversification' as const, m: result.diversification, max: 25 },
    { key: 'goalSetting' as const, m: result.goalSetting, max: 25 },
    { key: 'profitBalance' as const, m: result.profitBalance, max: 20 },
  ];

  // 모든 축이 만점의 80%+ → 액션 불필요
  if (axes.every(a => a.m.score / a.max >= 0.8)) return null;

  // 가장 낮은 비율 축
  const worst = axes.reduce((min, a) =>
    (a.m.score / a.max) < (min.m.score / min.max) ? a : min
  );
  const gap = Math.min(5, worst.max - worst.m.score);
  if (gap < 2) return null;

  switch (worst.key) {
    case 'concentration':
      return {
        axis: worst.key,
        emoji: '⚖️',
        title: `+${gap}점 더 올리려면`,
        action: '한 종목 비중이 너무 큰 듯해요. 비중 큰 종목을 일부 정리하거나 다른 섹터를 추가해보세요.',
        impact: gap,
      };
    case 'diversification': {
      // 섹터 갭 진단(대안 A) — 비어있는 '산업 카테고리'만 거울처럼 노출(특정 종목 지목 X).
      // 분류 신뢰 가능(classifiable)하고 빈 섹터가 있을 때만 이름을 밝힌다.
      // topSector가 추상 산업 카테고리일 때만 갭 단정('한국주식'/'기타' 같은 catch-all은 '한 산업 쏠림'으로
      // 오표기되므로 제외). 카피는 행위-편익 단정('커져요')을 피해 일반론('도움이 될 수 있어요')으로 약화.
      const sb = result.sectorBreakdown;
      const namedGapOk = sb && sb.classifiable && sb.absent.length > 0
        && DIVERSIFIABLE_SECTORS.includes(sb.topSector as typeof DIVERSIFIABLE_SECTORS[number]);
      const gapAction = namedGapOk
        ? `지금 ${sb.topSector}에 ${sb.topSectorPct}% 쏠려 있어요. 아직 없는 산업(${sb.absent.slice(0, 3).join(' · ')}) 중 하나를 더하면 한 산업에 쏠린 정도를 낮추는 데 도움이 될 수 있어요. 특정 섹터가 더 낫다는 뜻은 아니에요.`
        : '섹터가 한 쪽에 쏠려있어요. 다른 산업 종목을 더하면 한 산업에 쏠린 정도를 낮추는 데 도움이 될 수 있어요.';
      return {
        axis: worst.key,
        emoji: '🌐',
        title: `+${gap}점 더 올리려면`,
        action: gapAction,
        impact: gap,
      };
    }
    case 'goalSetting':
      return {
        axis: worst.key,
        emoji: '🎯',
        title: `+${gap}점 더 올리려면`,
        action: '목표 수익률이 없는 종목이 있어요. 종목별 목표를 정해두면 점수와 함께 매매 결정도 쉬워져요.',
        impact: gap,
      };
    case 'profitBalance':
      return {
        axis: worst.key,
        emoji: '🛡️',
        title: `+${gap}점 더 올리려면`,
        action: '손실 큰 종목에 손절가를 설정해두면 평균 손실이 줄어요. 위험 관리부터 시작해보세요.',
        impact: gap,
      };
  }
}
