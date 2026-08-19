export type StockCurrency = 'KRW' | 'USD';

const KOREAN_STOCK_CODE = /^\d{6}(?:\.(?:KS|KQ))?$/i;

/**
 * 한국 종목 시세·평단은 원화, 그 외 종목은 달러로 저장한다.
 * 과거 CSV/OCR가 접미사 없는 6자리 코드를 남긴 경우도 한국 종목으로 취급한다.
 */
export function isKoreanStockSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return normalized.endsWith('.KS')
    || normalized.endsWith('.KQ')
    || KOREAN_STOCK_CODE.test(normalized);
}

/**
 * 거래소 접미사가 유실된 6자리 한국 종목은 KOSPI 뒤 KOSDAQ 순으로 조회한다.
 * 접미사가 이미 있거나 미국 종목이면 정규화한 원래 심볼만 반환한다.
 */
export function getYahooSymbolCandidates(symbol: string): string[] {
  const normalized = symbol.trim().toUpperCase();
  return /^\d{6}$/.test(normalized)
    ? [`${normalized}.KS`, `${normalized}.KQ`]
    : [normalized];
}

/**
 * 같은 한국 종목의 접미사 유무를 가져오기/중복 판정에서 하나로 묶는다.
 * 한국 거래소의 6자리 종목코드는 시장 간에도 고유하므로 KS/KQ를 같은 코드로 본다.
 */
export function getStockIdentityKey(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  const koreanMatch = normalized.match(/^(\d{6})(?:\.(?:KS|KQ))?$/);
  return koreanMatch ? `KR:${koreanMatch[1]}` : normalized;
}

export function getStockCurrency(
  symbol: string,
  explicitCurrency?: StockCurrency,
): StockCurrency {
  // 6자리 코드와 KRX 접미사는 통화가 명백하다. 과거 OCR/CSV가 currency를
  // USD로 잘못 저장했더라도 한국 시세에 환율을 다시 곱하지 않도록 심볼을 우선한다.
  if (isKoreanStockSymbol(symbol)) return 'KRW';
  return explicitCurrency || 'USD';
}

export interface StockCurrencyAmounts {
  krw: number;
  usd: number;
}

export interface PortfolioCurrencyHolding {
  symbol: string;
  currency?: StockCurrency;
  avgCost: number;
  shares: number;
  currentPrice: number;
  dayChange?: number;
  purchaseRate?: number;
}

export interface PortfolioCurrencySummary {
  totalValueKrw: number;
  totalValueUsd: number;
  totalCostKrw: number;
  totalCostUsd: number;
  totalPnlKrw: number;
  totalPnlUsd: number;
  totalPnlPctKrw: number;
  totalPnlPctUsd: number;
  todayChangeKrw: number;
  todayChangeUsd: number;
  todayChangePctKrw: number;
  todayChangePctUsd: number;
  holdingCount: number;
}

/**
 * 종목의 현지 통화 금액을 동일 시점의 KRW·USD 금액으로 변환한다.
 */
export function convertStockAmount(
  symbol: string,
  localAmount: number,
  usdKrw: number,
  explicitCurrency?: StockCurrency,
): StockCurrencyAmounts {
  const amount = Number.isFinite(localAmount) ? localAmount : 0;
  const rate = Number.isFinite(usdKrw) && usdKrw > 0 ? usdKrw : 0;

  if (getStockCurrency(symbol, explicitCurrency) === 'KRW') {
    return {
      krw: amount,
      usd: rate > 0 ? amount / rate : 0,
    };
  }

  return {
    krw: rate > 0 ? amount * rate : 0,
    usd: amount,
  };
}

/**
 * 매입 금액은 미국 종목의 실제 매수 환율이 있으면 그 환율로 원화 환산한다.
 * 현재가·등락·목표가는 `convertStockAmount`로 현재 환율을 사용해야 한다.
 */
export function convertStockCostAmount(
  symbol: string,
  localAmount: number,
  usdKrw: number,
  purchaseRate?: number,
  explicitCurrency?: StockCurrency,
): StockCurrencyAmounts {
  if (getStockCurrency(symbol, explicitCurrency) === 'KRW') {
    return convertStockAmount(symbol, localAmount, usdKrw, explicitCurrency);
  }

  const amount = Number.isFinite(localAmount) ? localAmount : 0;
  const currentRate = Number.isFinite(usdKrw) && usdKrw > 0 ? usdKrw : 0;
  const buyRate = Number.isFinite(purchaseRate) && (purchaseRate as number) > 0
    ? purchaseRate as number
    : currentRate;

  return {
    krw: buyRate > 0 ? amount * buyRate : 0,
    usd: amount,
  };
}

/**
 * 혼합 포트폴리오를 KRW와 USD 두 기준으로 각각 합산한다.
 * KRW 원가는 미국 종목의 매수 환율을 반영하고, USD 원가는 종목 현지 통화를
 * 현재 환율로 달러 환산해 두 통화 화면의 금액·부호·수익률이 서로 모순되지 않게 한다.
 */
export function summarizePortfolioCurrency(
  holdings: PortfolioCurrencyHolding[],
  usdKrw: number,
): PortfolioCurrencySummary {
  let totalValueKrw = 0;
  let totalValueUsd = 0;
  let totalCostKrw = 0;
  let totalCostUsd = 0;
  let todayChangeKrw = 0;
  let todayChangeUsd = 0;
  let holdingCount = 0;

  holdings.forEach((holding) => {
    if (holding.avgCost <= 0
      || holding.shares <= 0
      || holding.currentPrice <= 0) {
      return;
    }

    const current = convertStockAmount(
      holding.symbol,
      holding.currentPrice,
      usdKrw,
      holding.currency,
    );
    const cost = convertStockCostAmount(
      holding.symbol,
      holding.avgCost,
      usdKrw,
      holding.purchaseRate,
      holding.currency,
    );
    const dayChange = convertStockAmount(
      holding.symbol,
      holding.dayChange || 0,
      usdKrw,
      holding.currency,
    );

    totalValueKrw += current.krw * holding.shares;
    totalValueUsd += current.usd * holding.shares;
    totalCostKrw += cost.krw * holding.shares;
    totalCostUsd += cost.usd * holding.shares;
    todayChangeKrw += dayChange.krw * holding.shares;
    todayChangeUsd += dayChange.usd * holding.shares;
    holdingCount += 1;
  });

  const totalPnlKrw = totalValueKrw - totalCostKrw;
  const totalPnlUsd = totalValueUsd - totalCostUsd;
  const previousValueKrw = totalValueKrw - todayChangeKrw;
  const previousValueUsd = totalValueUsd - todayChangeUsd;

  return {
    totalValueKrw,
    totalValueUsd,
    totalCostKrw,
    totalCostUsd,
    totalPnlKrw,
    totalPnlUsd,
    totalPnlPctKrw: totalCostKrw > 0 ? (totalPnlKrw / totalCostKrw) * 100 : 0,
    totalPnlPctUsd: totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0,
    todayChangeKrw,
    todayChangeUsd,
    todayChangePctKrw: previousValueKrw > 0
      ? (todayChangeKrw / previousValueKrw) * 100
      : 0,
    todayChangePctUsd: previousValueUsd > 0
      ? (todayChangeUsd / previousValueUsd) * 100
      : 0,
    holdingCount,
  };
}
