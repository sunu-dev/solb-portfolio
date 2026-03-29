/**
 * 로컬 규칙 기반 멘토별 적합도 점수 계산 (API 호출 없이 즉시)
 * 기술 지표 + 종목 특성으로 6개 멘토 관점의 점수를 산출
 */

interface ScoreInput {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  rsiVal?: number;
  trend?: string;
  cross?: string;
  bollingerStatus?: string;
  macdStatus?: string;
  volRatio?: number;
  avgCost?: number;
  shares?: number;
  targetReturn?: number;
}

export interface MentorScores {
  index: number;
  dividend: number;
  value: number;
  balance: number;
  growth: number;
  chart: number;
}

// 종목 유형 판별
function getAssetType(symbol: string): 'leveraged' | 'inverse' | 'index_etf' | 'sector_etf' | 'dividend_etf' | 'kr_stock' | 'stock' {
  const s = symbol.toUpperCase();
  // 레버리지 ETF
  if (['TQQQ', 'SOXL', 'UPRO', 'FNGU', 'KORU', 'LABU', 'TNA', 'SPXL', 'TECL', 'FAS'].includes(s)) return 'leveraged';
  // 인버스 ETF
  if (['SQQQ', 'SH', 'SPXS', 'SDOW', 'SPXU', 'TZA', 'FAZ'].includes(s)) return 'inverse';
  // 인덱스 ETF
  if (['SPY', 'VOO', 'VTI', 'QQQ', 'IWM', 'IVV', 'DIA', 'VT', 'VXUS'].includes(s)) return 'index_etf';
  // 배당 ETF
  if (['SCHD', 'VYM', 'HDV', 'DVY', 'DGRO', 'VIG', 'SPYD', 'JEPI', 'JEPQ'].includes(s)) return 'dividend_etf';
  // 섹터/테마 ETF
  if (['XLK', 'XLE', 'XLF', 'XLV', 'ARKK', 'ARKW', 'SOXX', 'SMH', 'TAN', 'ICLN'].includes(s)) return 'sector_etf';
  // 한국 주식
  if (s.endsWith('.KS') || s.endsWith('.KQ')) return 'kr_stock';
  return 'stock';
}

// 테크/혁신 관련 종목
function isInnovationRelated(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return ['NVDA', 'AMD', 'TSLA', 'PLTR', 'IONQ', 'RKLB', 'AI', 'PATH', 'CRSP', 'EDIT',
    'ARKK', 'ARKW', 'SOXX', 'SMH', 'DKNG', 'COIN', 'MSTR', 'SQ', 'SHOP'].includes(s);
}

export function calcMentorScores(input: ScoreInput): MentorScores {
  const type = getAssetType(input.symbol);
  const rsi = input.rsiVal || 50;
  const trend = input.trend || '';
  const macd = input.macdStatus || '';
  const vol = input.volRatio || 1;
  const isUp = input.changePercent >= 0;
  const hasPosition = (input.avgCost || 0) > 0 && (input.shares || 0) > 0;

  // 기본 점수
  const scores: MentorScores = { index: 3, dividend: 3, value: 3, balance: 3, growth: 3, chart: 3 };

  // === 종목 유형별 점수 조정 ===
  if (type === 'leveraged' || type === 'inverse') {
    scores.index = 1;
    scores.dividend = 1;
    scores.value = 1;
    scores.balance = 1;
    scores.growth = 2;
    scores.chart = trend.includes('상승') ? 4 : 2;
    return scores;
  }

  if (type === 'index_etf') {
    scores.index = 5;
    scores.dividend = 3;
    scores.value = 4;
    scores.balance = 4;
    scores.growth = 2;
    scores.chart = trend.includes('상승') ? 4 : trend.includes('하락') ? 2 : 3;
    return scores;
  }

  if (type === 'dividend_etf') {
    scores.index = 4;
    scores.dividend = 5;
    scores.value = 4;
    scores.balance = 4;
    scores.growth = 2;
    scores.chart = 3;
    return scores;
  }

  // === 개별 주식 / 섹터 ETF / 한국 주식 ===

  // 인덱스 관점: 개별 종목은 기본 낮음
  scores.index = type === 'sector_etf' ? 3 : 2;

  // 배당 관점: (데이터 없으면 중립)
  scores.dividend = 3;

  // 가치투자 관점: RSI 낮으면 저평가 가능성
  if (rsi < 30) scores.value = 4;
  else if (rsi < 45) scores.value = 4;
  else if (rsi > 70) scores.value = 2;
  if (hasPosition && input.avgCost && input.price < input.avgCost * 0.8) scores.value = 4; // 평단 대비 20% 이상 하락

  // 분산 관점: 단일 종목이면 낮음
  scores.balance = hasPosition ? 2 : 3;

  // 혁신성장 관점
  if (isInnovationRelated(input.symbol)) {
    scores.growth = rsi < 40 ? 5 : 4; // 혁신주 + 과매도면 최고
  } else {
    scores.growth = 2;
  }
  if (type === 'sector_etf') scores.growth = 3;

  // 차트분석 관점: 기술 지표 종합
  let chartScore = 3;
  // 추세
  if (trend.includes('상승')) chartScore += 1;
  else if (trend.includes('하락')) chartScore -= 1;
  // MACD
  if (macd.includes('상승') || macd.includes('매수')) chartScore += 0.5;
  else if (macd.includes('하락') || macd.includes('매도')) chartScore -= 0.5;
  // RSI
  if (rsi < 30) chartScore += 0.5; // 반등 가능
  else if (rsi > 70) chartScore -= 0.5; // 과열
  // 거래량
  if (vol > 1.5) chartScore += 0.5;
  scores.chart = Math.max(1, Math.min(5, Math.round(chartScore)));

  return scores;
}
