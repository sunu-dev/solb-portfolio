// ==========================================
// CONFIG — All constants (TypeScript)
// ==========================================

// --- Interfaces ---

export interface StockNote {
  text: string;
  emoji: string; // 감정 태그
  date: string;  // ISO date
}

export interface StockItem {
  symbol: string;
  avgCost: number;
  shares: number;
  targetReturn: number;         // 목표 수익률 (%)
  // 환차익 추적: 매수 시점 USD/KRW 환율 (가중 평균)
  purchaseRate?: number;
  // Investing-specific
  targetSell?: number;          // 목표 매도가 ($)
  targetProfitUSD?: number;     // 목표 수익금 ($) — e.g. 500 = $500 이익
  targetProfitKRW?: number;     // 목표 수익금 (₩) — e.g. 1000000 = 100만원 이익
  stopLoss?: number;            // 손절가 ($)
  stopLossPct?: number;         // 손절률 (%) — e.g. 10 = -10% 손실 시 알림
  buyZones?: number[];
  weight?: number;
  // Watching-specific
  buyBelow?: number;
  // Notes
  notes?: StockNote[];
}

export interface Transaction {
  date: string;
  price: number;
  shares: number;
  type: 'buy' | 'sell';
}

export interface AIReport {
  currentStatus: string;
  indicators: { name: string; value: string; signal: string }[];
  historicalNote: string;
  conclusion: { label: string; signal: string; desc: string };
}

export interface MacroIndicator {
  label: string;
  symbol?: string;
  type: 'stock' | 'forex' | 'kospi';
}

export interface MacroEntry {
  value: number | null;
  change: number;
  changePercent: number;
}

export interface QuoteData {
  c: number;   // current price
  d: number;   // change
  dp: number;  // change percent
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

export interface CandleRaw {
  s: string;
  c: number[];  // close
  h: number[];  // high
  l: number[];  // low
  o: number[];  // open
  t: number[];  // timestamps
  v: number[];  // volume
}

export interface Period {
  label: string;
  days: number;
}

export interface PresetEvent {
  id: string;
  name: string;
  emoji: string;
  startDate: string;
  baseDate: string;
  endDate: string | null;
  description: string;
  insight: string;
  basePrices: Record<string, number>;
  baseMacro: Record<string, number>;
  keyFacts?: string[];
  precomputed?: Record<string, {
    maxDrop: number;
    recovered: boolean;
    recoveryDays: number | null;
  }>;
}

export interface EventCacheEntry {
  basePrice: number;
  maxDrop: number;
  maxDropPrice?: number;
  maxDropDate?: string;
  currentChange: number;
  recovered: boolean;
  recoveryDays: number | null;
  dataSource?: 'actual' | 'precomputed' | 'fetched';
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

export interface NewsTag {
  label: string;
  bg: string;
  color: string;
}

export interface PatternResult {
  name: string;
  type: 'bullish' | 'potentially_bullish' | 'bearish' | 'neutral';
  desc: string;
}

export interface SignalSummary {
  cls: string;
  icon: string;
  label: string;
  body: string;
}

export interface SignalStatus {
  cls: string;
  text: string;
}

export type StockCategory = 'all' | 'investing' | 'watching' | 'sold';

export type PortfolioStocks = Record<'investing' | 'watching' | 'sold', StockItem[]>;

export interface SearchResult {
  symbol: string;
  description: string;
  type: string;
}

// --- Constants ---

export const CONFIG = {
  FINNHUB_BASE: 'https://finnhub.io/api/v1',
  ER_API_BASE: 'https://open.er-api.com/v6',
  RSS2JSON_BASE: 'https://api.rss2json.com/v1/api.json',
  REFRESH_INTERVAL: 30000,
  AUTO_REFRESH: true,
} as const;

export const STOCK_KR: Record<string, string> = {
  'MU': '마이크론',
  'MSFT': '마이크로소프트',
  'AVGO': '브로드컴',
  'AMZN': '아마존',
  'AAPL': '애플',
  'GOOGL': '구글',
  'META': '메타',
  'NVDA': '엔비디아',
  'TSLA': '테슬라',
  'AMD': 'AMD',
  'NFLX': '넷플릭스',
  'INTC': '인텔',
  'QCOM': '퀄컴',
  'TSM': 'TSMC',
  'SOXX': '반도체ETF',
  'ASTX': 'ASTX',
  'BEX': 'BEX',
};

export const PERIODS: Period[] = [
  { label: '1일', days: 1 },
  { label: '3일', days: 3 },
  { label: '1주', days: 7 },
  { label: '10일', days: 10 },
  { label: '2주', days: 14 },
  { label: '30일', days: 30 },
  { label: '2개월', days: 60 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
];

export const DEFAULT_STOCKS: PortfolioStocks = {
  investing: [],
  watching: [],
  sold: [],
};

export const MACRO_IND: MacroIndicator[] = [
  { label: 'S&P 500', symbol: '^GSPC', type: 'stock' },
  { label: 'NASDAQ', symbol: '^IXIC', type: 'stock' },
  { label: 'KOSPI', symbol: '^KS11', type: 'kospi' },
  { label: 'USD/KRW', type: 'forex' },
  { label: 'WTI Oil', symbol: 'USOIL', type: 'stock' },
  { label: 'VIX', symbol: '^VIX', type: 'stock' },
];

export const PRESET_EVENTS: PresetEvent[] = [
  {
    id: 'iran-war',
    name: '이란 전쟁',
    emoji: '⚔️',
    startDate: '2026-02-28',
    baseDate: '2026-02-27',
    endDate: null,
    description: '미국-이스라엘 연합 이란 공습. 유가 급등, 글로벌 증시 급락.',
    insight: '전쟁 충격은 보통 1~3개월 내 안정화됩니다. 현재 보유 종목은 10~15% 할인된 상태로, 분쟁 종료 시 강하게 반등할 가능성이 높아요.',
    keyFacts: ['WTI 유가 급등', '글로벌 증시 동반 급락', '방산주 급등'],
    basePrices: { MU: 487, MSFT: 418, AVGO: 349, AMZN: 223, ASTX: 62.5, BEX: 31.2 },
    baseMacro: { 'S&P 500': 6878.88, NASDAQ: 19850, KOSPI: 7050, 'USD/KRW': 1420, 'WTI Oil': 66.81, VIX: 14.2 },
  },
  {
    id: 'trump-tariff-2026',
    name: '2026 관세 충격',
    emoji: '🦅',
    startDate: '2026-01-20',
    baseDate: '2026-01-19',
    endDate: null,
    description: '트럼프 2기 관세 확대. Q1 S&P 500 -5.1%, NASDAQ -7.1%. 역대 7번째 빠른 조정 국면.',
    insight: '관세 불확실성이 장기화될수록 기술주 밸류에이션 압박이 커집니다. 무역 협상 진전 시 빠른 반등이 기대되지만, 공급망 재편 비용은 실적에 반영돼요.',
    keyFacts: ['S&P 500 Q1 -5.1%', 'NASDAQ -7.1%', '역대 7번째 빠른 조정'],
    basePrices: {},
    baseMacro: { 'S&P 500': 5980, NASDAQ: 19600, 'USD/KRW': 1468, 'WTI Oil': 73, VIX: 18 },
  },
  {
    id: 'ukraine-war',
    name: '우크라이나 전쟁',
    emoji: '🇺🇦',
    startDate: '2022-02-24',
    baseDate: '2022-02-23',
    endDate: null,
    description: '러시아 우크라이나 침공. 에너지/곡물 급등.',
    insight: 'S&P 500은 약 -13% 하락 후 6개월 내 회복을 시작했습니다. 반도체 섹터는 공급망 우려로 변동이 컸지만 장기 상승 추세를 유지했어요.',
    keyFacts: ['S&P 500 -13%', 'VIX 39 돌파', 'WTI 유가 +28%', '3년째 진행중'],
    // 분할 조정: AMZN 20:1 (2022.6), AVGO 10:1 (2024.7)
    basePrices: { MU: 89.16, MSFT: 287.93, AVGO: 57.16, AMZN: 152.60 },
    baseMacro: { 'S&P 500': 4348.87, NASDAQ: 13716.72, 'USD/KRW': 1199.50, 'WTI Oil': 92.10, VIX: 28.71 },
    precomputed: {
      MU: { maxDrop: -39.2, recovered: true, recoveryDays: 210 },
      MSFT: { maxDrop: -28.5, recovered: true, recoveryDays: 350 },
      AVGO: { maxDrop: -25.3, recovered: true, recoveryDays: 180 },
      AMZN: { maxDrop: -50.2, recovered: false, recoveryDays: null },
    },
  },
  {
    id: 'fed-hike-2022',
    name: '금리인상 베어마켓',
    emoji: '🏦',
    startDate: '2022-01-04',
    baseDate: '2022-01-03',
    endDate: '2022-10-13',
    description: '연준 급격한 금리 인상(0.25%→5.25%) 공포. NASDAQ -35%, S&P 500 -27% 하락.',
    insight: '금리 인상 사이클 정점이 주식 저점이었습니다. "금리 인하 전환"이 확실시됐을 때가 매수 타이밍이었고, 이후 1년 내 대부분 종목이 신고가를 경신했어요.',
    keyFacts: ['NASDAQ -35%', 'S&P 500 -27%', '9개월 지속', '0.25% → 5.25%'],
    // 분할 조정: AMZN 20:1 (2022.6), AVGO 10:1 (2024.7)
    basePrices: { MU: 92.77, MSFT: 336.32, AVGO: 64.28, AMZN: 170.40 },
    baseMacro: { 'S&P 500': 4796, NASDAQ: 15832, 'USD/KRW': 1190, 'WTI Oil': 76, VIX: 17.2 },
    precomputed: {
      MU: { maxDrop: -48.1, recovered: true, recoveryDays: 120 },
      MSFT: { maxDrop: -36.5, recovered: true, recoveryDays: 170 },
      AVGO: { maxDrop: -33.1, recovered: true, recoveryDays: 130 },
      AMZN: { maxDrop: -51.8, recovered: true, recoveryDays: 350 },
    },
  },
  {
    id: 'covid',
    name: '코로나',
    emoji: '🦠',
    startDate: '2020-02-20',
    baseDate: '2020-02-19',
    endDate: '2020-06-08',
    description: 'S&P 500 -34% 급락 후 5개월 만에 회복.',
    insight: '코로나 최저점(3/23)에서 매수한 투자자는 1년 내 +70% 이상 수익을 달성했습니다. 패닉 속 분할 매수 전략이 효과적이었어요.',
    keyFacts: ['S&P 500 -34%', '최저점까지 33일', '회복까지 115일', '이후 1년 +70%'],
    // 분할 조정: AMZN 20:1 (2022.6), AVGO 10:1 (2024.7)
    basePrices: { MU: 57.64, MSFT: 187.28, AVGO: 30.90, AMZN: 108.51 },
    baseMacro: { 'S&P 500': 3373.23, NASDAQ: 9817.18, 'USD/KRW': 1185.50, 'WTI Oil': 53.27, VIX: 14.38 },
    precomputed: {
      MU: { maxDrop: -34.1, recovered: true, recoveryDays: 95 },
      MSFT: { maxDrop: -28.6, recovered: true, recoveryDays: 48 },
      AVGO: { maxDrop: -31.4, recovered: true, recoveryDays: 63 },
      AMZN: { maxDrop: -22.9, recovered: true, recoveryDays: 24 },
    },
  },
];

export const NEWS_QUERIES: Record<string, { q: string; locale?: string; maxHours?: number }> = {
  us:  { q: '미국 증시 나스닥',   locale: 'ko', maxHours: 24 },
  kr:  { q: '코스피 코스닥 증시', locale: 'ko', maxHours: 24 },
  hot: { q: '주식 급등',          locale: 'ko', maxHours: 24 },
};

// --- Trend type ---
export type TrendType = 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down' | 'unknown';

export const TREND_TEXT: Record<TrendType, string> = {
  strong_up: '강한 상승 추세',
  up: '상승 추세',
  sideways: '횡보',
  down: '하락 추세',
  strong_down: '강한 하락 추세',
  unknown: '분석 중',
};

export const TREND_INFO: Record<TrendType, { icon: string; text: string; desc: string }> = {
  strong_up: { icon: '🟢', text: '강한 상승', desc: '5일>20일>60일선' },
  up: { icon: '🟢', text: '상승', desc: '가격이 20일선 위' },
  sideways: { icon: '🟡', text: '횡보', desc: '방향 불명확' },
  down: { icon: '🔴', text: '하락', desc: '가격이 20일선 아래' },
  strong_down: { icon: '🔴', text: '강한 하락', desc: '5일<20일<60일선' },
  unknown: { icon: '⭕', text: '분석 중', desc: '데이터 부족' },
};

// Avatar color helper
export const AVATAR_COLORS: Record<string, string> = {
  'MU': '#4A90D9',
  'MSFT': '#00A4EF',
  'AVGO': '#EF4444',
  'AMZN': '#FF9900',
  'AAPL': '#555555',
  'GOOGL': '#4285F4',
  'META': '#1877F2',
  'NVDA': '#76B900',
  'TSLA': '#E82127',
  'AMD': '#ED1C24',
  'ASTX': '#6366F1',
  'BEX': '#EC4899',
};

export function getAvatarColor(symbol: string): string {
  if (AVATAR_COLORS[symbol]) return AVATAR_COLORS[symbol];
  const FALLBACK = ['#3182F6', '#EF4452', '#00C6BE', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#34C759'];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK[Math.abs(hash) % FALLBACK.length];
}
