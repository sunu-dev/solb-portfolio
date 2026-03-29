/**
 * 종목 속성 6축 점수 계산 (로컬, API 0회)
 * 안전성 / 성장성 / 가치 / 수익성 / 추세 / 관심도
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

export interface StockAttributes {
  safety: number;     // 안전성
  growth: number;     // 성장성
  value: number;      // 가치
  income: number;     // 수익성
  trend: number;      // 추세
  interest: number;   // 관심도
}

export const ATTRIBUTE_LABELS: { key: keyof StockAttributes; label: string; icon: string; desc: string }[] = [
  { key: 'safety', label: '안전성', icon: '🛡️', desc: '이 종목이 얼마나 안전한가' },
  { key: 'growth', label: '성장성', icon: '🌱', desc: '미래 성장 잠재력' },
  { key: 'value', label: '가치', icon: '💎', desc: '현재 가격이 적정한가' },
  { key: 'income', label: '수익성', icon: '💰', desc: '배당/현금흐름' },
  { key: 'trend', label: '추세', icon: '📈', desc: '최근 흐름이 좋은가' },
  { key: 'interest', label: '관심도', icon: '🔥', desc: '시장의 관심' },
];

// 종목 유형 판별
function getAssetType(symbol: string): 'leveraged' | 'inverse' | 'index_etf' | 'sector_etf' | 'dividend_etf' | 'kr_stock' | 'stock' {
  const s = symbol.toUpperCase();
  if (['TQQQ', 'SOXL', 'UPRO', 'FNGU', 'KORU', 'LABU', 'TNA', 'SPXL', 'TECL', 'FAS'].includes(s)) return 'leveraged';
  if (['SQQQ', 'SH', 'SPXS', 'SDOW', 'SPXU', 'TZA', 'FAZ'].includes(s)) return 'inverse';
  if (['SPY', 'VOO', 'VTI', 'QQQ', 'IWM', 'IVV', 'DIA', 'VT', 'VXUS'].includes(s)) return 'index_etf';
  if (['SCHD', 'VYM', 'HDV', 'DVY', 'DGRO', 'VIG', 'SPYD', 'JEPI', 'JEPQ'].includes(s)) return 'dividend_etf';
  if (['XLK', 'XLE', 'XLF', 'XLV', 'ARKK', 'ARKW', 'SOXX', 'SMH', 'TAN', 'ICLN'].includes(s)) return 'sector_etf';
  if (s.endsWith('.KS') || s.endsWith('.KQ')) return 'kr_stock';
  return 'stock';
}

function isInnovationRelated(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return ['NVDA', 'AMD', 'TSLA', 'PLTR', 'IONQ', 'RKLB', 'AI', 'PATH', 'CRSP',
    'ARKK', 'ARKW', 'SOXX', 'SMH', 'COIN', 'MSTR', 'SQ', 'SHOP', 'NET', 'SNOW'].includes(s);
}

function clamp(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

export function calcStockAttributes(input: ScoreInput): StockAttributes {
  const type = getAssetType(input.symbol);
  const rsi = input.rsiVal || 50;
  const trendStr = input.trend || '';
  const macd = input.macdStatus || '';
  const vol = input.volRatio || 1;
  const dp = Math.abs(input.changePercent);

  let safety = 3, growth = 3, value = 3, income = 3, trend = 3, interest = 3;

  // ===== 종목 유형별 기본 프로필 =====
  switch (type) {
    case 'leveraged':
      safety = 1; growth = 3; value = 2; income = 1; trend = 3; interest = 4;
      break;
    case 'inverse':
      safety = 1; growth = 1; value = 2; income = 1; trend = 3; interest = 3;
      break;
    case 'index_etf':
      safety = 5; growth = 3; value = 4; income = 3; trend = 3; interest = 3;
      break;
    case 'dividend_etf':
      safety = 4; growth = 2; value = 4; income = 5; trend = 3; interest = 2;
      break;
    case 'sector_etf':
      safety = 3; growth = 3; value = 3; income = 2; trend = 3; interest = 3;
      break;
    case 'kr_stock':
      safety = 3; growth = 3; value = 3; income = 2; trend = 3; interest = 3;
      break;
    case 'stock':
    default:
      safety = 3; growth = 3; value = 3; income = 2; trend = 3; interest = 3;
  }

  // ===== 기술 지표 기반 조정 (개별 주식/ETF) =====
  if (type !== 'leveraged' && type !== 'inverse') {

    // 안전성: 변동성 낮을수록, RSI 중립일수록 안전
    if (dp < 1) safety += 1;
    else if (dp > 5) safety -= 1;
    if (rsi > 30 && rsi < 70) safety += 0.5; // 극단치 아니면 안정적
    else safety -= 0.5;

    // 성장성: 혁신 섹터면 높음
    if (isInnovationRelated(input.symbol)) growth += 1.5;
    if (type === 'sector_etf' && ['ARKK', 'SOXX', 'SMH'].includes(input.symbol.toUpperCase())) growth += 1;

    // 가치: RSI 낮으면 저평가 가능성, 평단 대비 할인이면 가산
    if (rsi < 30) value += 1.5;
    else if (rsi < 40) value += 0.5;
    else if (rsi > 70) value -= 1;
    if (input.avgCost && input.price > 0 && input.price < input.avgCost * 0.8) value += 1;

    // 수익성: 배당 ETF면 높음, 일반 주식은 보통
    if (type === 'dividend_etf') income = 5;

    // 추세: 이동평균/MACD/RSI 종합
    if (trendStr.includes('상승')) trend += 1;
    else if (trendStr.includes('하락')) trend -= 1;
    if (macd.includes('상승') || macd.includes('매수')) trend += 0.5;
    else if (macd.includes('하락') || macd.includes('매도')) trend -= 0.5;
    if (rsi < 30) trend -= 0.5; // 약세
    else if (rsi > 60 && rsi < 75) trend += 0.5; // 강세(과열 아닌)

    // 관심도: 거래량 비율 + 일일 변동폭
    if (vol > 2) interest += 1.5;
    else if (vol > 1.3) interest += 0.5;
    else if (vol < 0.5) interest -= 1;
    if (dp > 3) interest += 0.5;
  }

  // 레버리지/인버스는 추세만 기술 지표로 조정
  if (type === 'leveraged' || type === 'inverse') {
    if (trendStr.includes('상승')) trend += 1;
    else if (trendStr.includes('하락')) trend -= 1;
    if (vol > 1.5) interest += 0.5;
  }

  return {
    safety: clamp(safety),
    growth: clamp(growth),
    value: clamp(value),
    income: clamp(income),
    trend: clamp(trend),
    interest: clamp(interest),
  };
}
