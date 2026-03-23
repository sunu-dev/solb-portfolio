// ==========================================
// CONFIG — All constants (TypeScript)
// ==========================================

// --- Interfaces ---

export interface StockItem {
  symbol: string;
  avgCost: number;
  shares: number;
  targetReturn: number;
  // Short-specific
  targetSell?: number;
  stopLoss?: number;
  // Long-specific
  buyZones?: number[];
  weight?: number;
  // Watch-specific
  buyBelow?: number;
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
  precomputed?: Record<string, {
    maxDrop: number;
    recovered: boolean;
    recoveryDays: number | null;
  }>;
}

export interface EventCacheEntry {
  basePrice: number;
  maxDrop: number;
  currentChange: number;
  recovered: boolean;
  recoveryDays: number | null;
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

export type StockCategory = 'short' | 'long' | 'watch';

export type PortfolioStocks = Record<StockCategory, StockItem[]>;

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
  'MU': '\uB9C8\uC774\uD06C\uB860',
  'MSFT': '\uB9C8\uC774\uD06C\uB85C\uC18C\uD504\uD2B8',
  'AVGO': '\uBE0C\uB85C\uB4DC\uCF54',
  'AMZN': '\uC544\uB9C8\uC874',
  'AAPL': '\uC560\uD50C',
  'GOOGL': '\uAD6C\uAE00',
  'META': '\uBA54\uD0C0',
  'NVDA': '\uC5D4\uBE44\uB514\uC544',
  'TSLA': '\uD14C\uC2AC\uB77C',
  'AMD': 'AMD',
  'NFLX': '\uB137\uD50C\uB9AD\uC2A4',
  'INTC': '\uC778\uD154',
  'QCOM': '\uD004\uCEF4',
  'TSM': 'TSMC',
  'SOXX': '\uBC18\uB3C4\uCCB4ETF',
};

export const PERIODS: Period[] = [
  { label: '1\uC77C', days: 1 },
  { label: '3\uC77C', days: 3 },
  { label: '1\uC8FC', days: 7 },
  { label: '10\uC77C', days: 10 },
  { label: '2\uC8FC', days: 14 },
  { label: '30\uC77C', days: 30 },
  { label: '2\uAC1C\uC6D4', days: 60 },
  { label: '3\uAC1C\uC6D4', days: 90 },
  { label: '6\uAC1C\uC6D4', days: 180 },
  { label: '1\uB144', days: 365 },
];

export const DEFAULT_STOCKS: PortfolioStocks = {
  short: [
    { symbol: 'ASTX', targetSell: 48.93, stopLoss: 37.81, avgCost: 44.48, shares: 470, targetReturn: 10 },
    { symbol: 'BEX', targetSell: 27.28, stopLoss: 21.08, avgCost: 24.80, shares: 840, targetReturn: 10 },
  ],
  long: [
    { symbol: 'MU', buyZones: [430, 404, 380], weight: 40, avgCost: 0, shares: 0, targetReturn: 20 },
    { symbol: 'MSFT', buyZones: [385, 366, 350], weight: 30, avgCost: 0, shares: 0, targetReturn: 15 },
    { symbol: 'AVGO', buyZones: [315, 298, 280], weight: 30, avgCost: 0, shares: 0, targetReturn: 15 },
  ],
  watch: [
    { symbol: 'AMZN', buyBelow: 190, avgCost: 0, shares: 0, targetReturn: 0 },
  ],
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
    name: '\uC774\uB780 \uC804\uC7C1',
    emoji: '\u2694\uFE0F',
    startDate: '2026-02-28',
    baseDate: '2026-02-27',
    endDate: null,
    description: '\uBBF8\uAD6D-\uC774\uC2A4\uB77C\uC5D8 \uC5F0\uD569 \uC774\uB780 \uACF5\uC2B5. \uC720\uAC00 \uAE09\uB4F1, \uAE00\uB85C\uBC8C \uC99D\uC2DC \uAE09\uB77D.',
    insight: '\uC804\uC7C1 \uCDA9\uACA9\uC740 \uBCF4\uD1B5 1~3\uAC1C\uC6D4 \uB0B4 \uC548\uC815\uD654\uB429\uB2C8\uB2E4. \uD604\uC7AC \uBCF4\uC720 \uC885\uBAA9\uC740 10~15% \uD560\uC778\uB41C \uC0C1\uD0DC\uB85C, \uBD84\uC7C1 \uC885\uB8CC \uC2DC \uAC15\uD558\uAC8C \uBC18\uB4F1\uD560 \uAC00\uB2A5\uC131\uC774 \uB192\uC544\uC694.',
    basePrices: { MU: 487, MSFT: 418, AVGO: 349, AMZN: 223, ASTX: 62.5, BEX: 31.2 },
    baseMacro: { 'S&P 500': 6878.88, NASDAQ: 19850, KOSPI: 7050, 'USD/KRW': 1420, 'WTI Oil': 66.81, VIX: 14.2 },
  },
  {
    id: 'ukraine-war',
    name: '\uC6B0\uD06C\uB77C\uC774\uB098 \uC804\uC7C1',
    emoji: '\uD83C\uDDFA\uD83C\uDDE6',
    startDate: '2022-02-24',
    baseDate: '2022-02-23',
    endDate: null,
    description: '\uB7EC\uC2DC\uC544 \uC6B0\uD06C\uB77C\uC774\uB098 \uCE68\uACF5. \uC5D0\uB108\uC9C0/\uACE1\uBB3C \uAE09\uB4F1.',
    insight: 'S&P 500\uC740 \uC57D -13% \uD558\uB77D \uD6C4 6\uAC1C\uC6D4 \uB0B4 \uD68C\uBCF5\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4. \uBC18\uB3C4\uCCB4 \uC139\uD130\uB294 \uACF5\uAE09\uB9DD \uC6B0\uB824\uB85C \uBCC0\uB3D9\uC774 \uCEF4\uC9C0\uB9CC \uC7A5\uAE30 \uC0C1\uC2B9 \uCD94\uC138\uB97C \uC720\uC9C0\uD588\uC5B4\uC694.',
    basePrices: { MU: 89.16, MSFT: 287.93, AVGO: 571.64, AMZN: 3052.03 },
    baseMacro: { 'S&P 500': 4348.87, NASDAQ: 13716.72, 'USD/KRW': 1199.50, 'WTI Oil': 92.10, VIX: 28.71 },
    precomputed: {
      MU: { maxDrop: -39.2, recovered: true, recoveryDays: 210 },
      MSFT: { maxDrop: -28.5, recovered: true, recoveryDays: 350 },
      AVGO: { maxDrop: -25.3, recovered: true, recoveryDays: 180 },
      AMZN: { maxDrop: -50.2, recovered: false, recoveryDays: null },
    },
  },
  {
    id: 'covid',
    name: '\uCF54\uB85C\uB098 \uAE09\uB77D',
    emoji: '\uD83E\uDDA0',
    startDate: '2020-02-20',
    baseDate: '2020-02-19',
    endDate: '2020-06-08',
    description: 'S&P 500 -34% \uAE09\uB77D \uD6C4 5\uAC1C\uC6D4 \uB9CC\uC5D0 \uD68C\uBCF5.',
    insight: '\uCF54\uB85C\uB098 \uCD5C\uC800\uC810(3/23)\uC5D0\uC11C \uB9E4\uC218\uD55C \uD22C\uC790\uC790\uB294 1\uB144 \uB0B4 +70% \uC774\uC0C1 \uC218\uC775\uC744 \uB2EC\uC131\uD588\uC2B5\uB2C8\uB2E4. \uD328\uB2C9 \uC18D \uBD84\uD560 \uB9E4\uC218 \uC804\uB7B5\uC774 \uD6A8\uACFC\uC801\uC774\uC5C8\uC5B4\uC694.',
    basePrices: { MU: 57.64, MSFT: 187.28, AVGO: 308.96, AMZN: 2170.22 },
    baseMacro: { 'S&P 500': 3373.23, NASDAQ: 9817.18, 'USD/KRW': 1185.50, 'WTI Oil': 53.27, VIX: 14.38 },
    precomputed: {
      MU: { maxDrop: -34.1, recovered: true, recoveryDays: 95 },
      MSFT: { maxDrop: -28.6, recovered: true, recoveryDays: 48 },
      AVGO: { maxDrop: -31.4, recovered: true, recoveryDays: 63 },
      AMZN: { maxDrop: -22.9, recovered: true, recoveryDays: 24 },
    },
  },
];

export const NEWS_QUERIES: Record<string, string> = {
  us: '\uBBF8\uAD6D \uC99D\uC2DC \uB098\uC2A4\uB2E5 S&P500 \uC6D4\uAC00 \uC5F0\uC900',
  kr: '\uD55C\uAD6D \uC99D\uC2DC \uCF54\uC2A4\uD53C \uCF54\uC2A4\uB2E5 \uC0BC\uC131\uC804\uC790',
  hot: '\uC8FC\uC2DD \uD22C\uC790 \uD56B\uC774\uC288 \uC804\uB9DD \uAE09\uB4F1',
};

// --- Trend type ---
export type TrendType = 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down' | 'unknown';

export const TREND_TEXT: Record<TrendType, string> = {
  strong_up: '\uAC15\uD55C \uC0C1\uC2B9 \uCD94\uC138',
  up: '\uC0C1\uC2B9 \uCD94\uC138',
  sideways: '\uD6A1\uBCF4',
  down: '\uD558\uB77D \uCD94\uC138',
  strong_down: '\uAC15\uD55C \uD558\uB77D \uCD94\uC138',
  unknown: '\uBD84\uC11D \uC911',
};

export const TREND_INFO: Record<TrendType, { icon: string; text: string; desc: string }> = {
  strong_up: { icon: '\uD83D\uDFE2', text: '\uAC15\uD55C \uC0C1\uC2B9', desc: '5\uC77C>20\uC77C>60\uC77C\uC120' },
  up: { icon: '\uD83D\uDFE2', text: '\uC0C1\uC2B9', desc: '\uAC00\uACA9\uC774 20\uC77C\uC120 \uC704' },
  sideways: { icon: '\uD83D\uDFE1', text: '\uD6A1\uBCF4', desc: '\uBC29\uD5A5 \uBD88\uBA85\uD655' },
  down: { icon: '\uD83D\uDD34', text: '\uD558\uB77D', desc: '\uAC00\uACA9\uC774 20\uC77C\uC120 \uC544\uB798' },
  strong_down: { icon: '\uD83D\uDD34', text: '\uAC15\uD55C \uD558\uB77D', desc: '5\uC77C<20\uC77C<60\uC77C\uC120' },
  unknown: { icon: '\u2B55', text: '\uBD84\uC11D \uC911', desc: '\uB370\uC774\uD130 \uBD80\uC871' },
};
