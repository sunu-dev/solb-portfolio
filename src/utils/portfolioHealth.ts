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
 * 포트폴리오 건강 점수 계산 (0~100)
 * - 집중도 30 + 섹터분산 25 + 목표설정 25 + 손익밸런스 20
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

  // 1. 집중도 (30점)
  const weights = stocks.map(s => totalValue > 0 ? (s.value / totalValue) * 100 : 0);
  const maxWeight = Math.max(...weights);
  let concScore = 30;
  const topSymbol = stocks.reduce((a, b) => a.value > b.value ? a : b).symbol;
  const topName = STOCK_KR[topSymbol] || topSymbol;
  let concDetail = `${stocks.length}개 종목에 고르게 분산 (최대 ${maxWeight.toFixed(0)}%)`;
  if (maxWeight > 70)      { concScore = 5;  concDetail = `${topName}에 ${maxWeight.toFixed(0)}% 집중 — 위험`; }
  else if (maxWeight > 50) { concScore = 15; concDetail = `${topName} 비중 ${maxWeight.toFixed(0)}% — 분산 필요`; }
  else if (maxWeight > 35) { concScore = 22; concDetail = `${topName} 비중 ${maxWeight.toFixed(0)}% — 적정 수준`; }

  // 2. 섹터 분산 (25점)
  const sectors = new Set(stocks.map(s => getSector(s.symbol)));
  const sectorList = [...sectors];
  let divScore = 25;
  let divDetail = `${sectorList.join(', ')} 등 ${sectors.size}개 섹터`;
  if (sectors.size <= 1)      { divScore = 5;  divDetail = `${sectorList[0] || '알 수 없음'} 섹터에만 투자 중`; }
  else if (sectors.size === 2){ divScore = 15; divDetail = `${sectorList.join(', ')} 2개 섹터 — 더 분산 추천`; }

  // 3. 목표 설정 (25점)
  const withGoal = stocks.filter(s => s.targetReturn > 0).length;
  const goalRatio = withGoal / stocks.length;
  const goalScore = Math.round(goalRatio * 25);
  const goalDetail = goalRatio === 1
    ? `${stocks.length}개 종목 모두 목표 수익률 설정 완료`
    : `${stocks.length}개 중 ${withGoal}개 종목만 목표 설정됨`;

  // 4. 손익 밸런스 (20점)
  let winCount = 0;
  stocks.forEach(s => {
    if (s.avgCost > 0 && s.currentPrice > s.avgCost) winCount++;
  });
  const winRate = winCount / stocks.length;
  const balScore = Math.round(winRate * 20);
  const balDetail = `승률 ${Math.round(winRate * 100)}% (${winCount}/${stocks.length})`;

  const total = concScore + divScore + goalScore + balScore;

  const scoreColor = (s: number, max: number) => {
    const ratio = s / max;
    if (ratio >= 0.8) return 'var(--color-success, #16A34A)';
    if (ratio >= 0.5) return 'var(--color-warning, #FF9500)';
    return 'var(--color-danger, #EF4452)';
  };

  return {
    total,
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
