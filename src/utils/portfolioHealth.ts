import { STOCK_KR } from '@/config/constants';

// 섹터 분류 (심볼 기반 간이 분류)
const SECTOR_MAP: Record<string, string> = {
  NVDA: 'IT', AMD: 'IT', INTC: 'IT', MU: 'IT', AVGO: 'IT', QCOM: 'IT', TSM: 'IT',
  AAPL: 'IT', MSFT: 'IT', GOOG: 'IT', GOOGL: 'IT', META: 'IT', AMZN: '소비재',
  TSLA: '자동차', NFLX: '미디어', DIS: '미디어',
  JPM: '금융', V: '금융', MA: '금융', BAC: '금융', GS: '금융',
  JNJ: '헬스케어', UNH: '헬스케어', PFE: '헬스케어', ABBV: '헬스케어', LLY: '헬스케어',
  XOM: '에너지', CVX: '에너지', COP: '에너지',
  KO: '소비재', PEP: '소비재', PG: '소비재', WMT: '소비재', COST: '소비재',
};

export function getSector(symbol: string): string {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return '한국주식';
  return SECTOR_MAP[symbol] || '기타';
}

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

export interface HealthResult {
  total: number;
  concentration: MetricResult;
  diversification: MetricResult;
  goalSetting: MetricResult;
  profitBalance: MetricResult;
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
