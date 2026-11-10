/**
 * Phase M-1.2 — 다중 broker 분산 보유 종목 통합 selector.
 *
 * docs/BROKER_MERGE_FEATURE.md 합의 (옵션 A):
 * - StockItem raw row 그대로 보존 (마이그레이션 0)
 * - selector가 같은 symbol을 grouping → 가중평균 평단가·환율
 * - lots 필드로 broker별 원본 lot 보존 (편집·세금 시뮬 위해)
 *
 * 사용:
 *   const merged = mergeHoldings(stocks.investing);
 *   const hasMulti = merged.some(h => h.hasMultipleBrokers);
 */

import type { StockItem, Broker } from '@/config/constants';
import { getStockCurrency, getStockIdentityKey, type StockCurrency } from './stockCurrency';
import { resolveUsdKrwState } from './koreanNumber';

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
export const isRegisteredHolding = (stock: StockItem) => !stock.demo && positive(stock.shares);

function holdingQuote(symbol: string, quotes: Record<string, unknown>): { c: number; d?: unknown } | null {
  const identity = getStockIdentityKey(symbol);
  const keys = [symbol, symbol.trim().toUpperCase(), ...Object.keys(quotes).filter(key => getStockIdentityKey(key) === identity)];
  for (const key of new Set(keys)) {
    const quote = quotes[key] as { c?: unknown; d?: unknown } | undefined;
    if (positive(quote?.c)) return { c: quote.c, d: quote.d };
  }
  return null;
}

/** Use an observed quote, including legacy Korean aliases; never substitute purchase price. */
export function holdingPrice(symbol: string, quotes: Record<string, unknown>): number | null {
  return holdingQuote(symbol, quotes)?.c ?? null;
}

const completeSum = (values: (number | null)[]): number | null => {
  if (!values.length || values.some(value => value === null || !Number.isFinite(value))) return null;
  const total = (values as number[]).reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? total : null;
};

/** Complete totals only. Missing inputs must not become zero returns or partial totals. */
export function holdingTotals(stocks: StockItem[], quotes: Record<string, unknown>, currency: StockCurrency = 'KRW') {
  const holdings = stocks.filter(isRegisteredHolding), fx = resolveUsdKrwState(quotes);
  let missingPrices = 0, missingCosts = 0, missingPurchaseRates = 0, missingFx = false;
  const rows = holdings.map(stock => {
    const usd = getStockCurrency(stock.symbol, stock.currency) === 'USD', quote = holdingQuote(stock.symbol, quotes), price = quote?.c ?? null;
    if (price === null) missingPrices++;
    if (!positive(stock.avgCost)) missingCosts++;
    const needsFx = usd !== (currency === 'USD');
    if (usd && currency === 'KRW' && !positive(stock.purchaseRate)) missingPurchaseRates++;
    if (needsFx && fx.stale) missingFx = true;
    const convert = (amount: number | null) => amount === null || (needsFx && fx.stale) ? null : amount * (needsFx ? (usd ? fx.rate : 1 / fx.rate) : 1);
    const change = quote?.d;
    return {
      value: convert(price !== null ? price * stock.shares : null),
      cost: !positive(stock.avgCost) ? null : usd && currency === 'KRW'
        ? positive(stock.purchaseRate) ? stock.avgCost * stock.shares * stock.purchaseRate : null
        : convert(stock.avgCost * stock.shares),
      day: price !== null && typeof change === 'number' && Number.isFinite(change) && price - change > 0 ? convert(change * stock.shares) : null,
    };
  });
  const value = completeSum(rows.map(row => row.value)), cost = completeSum(rows.map(row => row.cost));
  const dayChange = completeSum(rows.map(row => row.day));
  const pnl = value !== null && cost !== null && cost > 0 ? value - cost : null;
  return { value, cost, pnl, pnlPct: pnl !== null && cost !== null ? pnl / cost * 100 : null,
    dayChange, dayPct: dayChange !== null && value !== null && value - dayChange > 0 ? dayChange / (value - dayChange) * 100 : null,
    missingPrices, missingCosts, missingPurchaseRates, missingFx,
    count: new Set(holdings.map(stock => `${getStockIdentityKey(stock.symbol)}:${getStockCurrency(stock.symbol, stock.currency)}`)).size };
}

export interface MergedHolding {
  id: string;
  symbol: string;
  currency: StockCurrency;
  /** 합산 보유 수량 */
  totalShares: number;
  /** USD/KRW 종목별 가중평균 평단가 — Σ(avgCost × shares) / Σshares */
  mergedAvgCost: number | null;
  /** 환율 가중평균 (USD 종목만 의미 있음) — Σ(rate × avgCost × shares) / Σ(avgCost × shares) */
  mergedPurchaseRate?: number;
  /** 합산 목표 수익률 (가중평균) — 미설정 row 제외 */
  mergedTargetReturn: number;
  /** broker별 원본 lot — 편집·세금 시뮬·매도 순서 결정에 사용 */
  lots: StockItem[];
  /** 등록된 broker 목록 (중복 제거) */
  brokers: Broker[];
  /** 자동 추론 — 2개 이상 broker에 분산 보유? */
  hasMultipleBrokers: boolean;
  /** 미지정 broker 포함 여부 (사용자 입력 안 한 lot) */
  hasUnspecifiedBroker: boolean;
}

/**
 * 같은 symbol을 가진 StockItem들을 통합. broker별 lot은 보존.
 *
 * 가중평균 평단가 계산은 통화 무관 (USD/KRW 종목별 다른 인스턴스로 분리되어 들어옴).
 * 환율은 USD 종목의 purchaseRate가 있을 때만 가중평균 산출.
 */
export function mergeHoldings(stocks: StockItem[]): MergedHolding[] {
  const groups = new Map<string, StockItem[]>();

  for (const s of stocks.filter(isRegisteredHolding)) {
    const key = `${getStockIdentityKey(s.symbol)}:${getStockCurrency(s.symbol, s.currency)}`;
    const arr = groups.get(key) || [];
    arr.push(s);
    groups.set(key, arr);
  }

  const result: MergedHolding[] = [];

  for (const [id, lots] of groups.entries()) {
    const symbol = (lots.find(lot => /\.K[SQ]$/i.test(lot.symbol.trim())) ?? lots[0]).symbol.trim().toUpperCase();
    const currency = getStockCurrency(lots[0].symbol, lots[0].currency);
    const totalShares = lots.reduce((sum, l) => sum + (l.shares || 0), 0);
    const weightedAvgSum = lots.reduce((sum, l) => sum + (l.avgCost || 0) * (l.shares || 0), 0);
    const mergedAvgCost = lots.every(lot => positive(lot.avgCost)) && totalShares > 0 && Number.isFinite(weightedAvgSum) ? weightedAvgSum / totalShares : null;

    // 환율 가중평균 — purchaseRate가 있는 lot만, avgCost × shares 가중
    const ratedLots = lots.filter(l => positive(l.purchaseRate) && positive(l.avgCost));
    let mergedPurchaseRate: number | undefined;
    if (currency === 'USD' && ratedLots.length === lots.length && mergedAvgCost !== null) {
      const rateNum = ratedLots.reduce(
        (sum, l) => sum + (l.purchaseRate || 0) * (l.avgCost || 0) * (l.shares || 0),
        0,
      );
      const rateDen = ratedLots.reduce(
        (sum, l) => sum + (l.avgCost || 0) * (l.shares || 0),
        0,
      );
      mergedPurchaseRate = rateDen > 0 ? rateNum / rateDen : undefined;
    }

    // 목표 수익률 — 설정된 lot만 가중평균
    const targetLots = lots.filter(l => l.targetReturn && l.targetReturn > 0);
    let mergedTargetReturn = 0;
    if (targetLots.length > 0) {
      const tNum = targetLots.reduce((sum, l) => sum + (l.targetReturn || 0) * (l.shares || 0), 0);
      const tDen = targetLots.reduce((sum, l) => sum + (l.shares || 0), 0);
      mergedTargetReturn = tDen > 0 ? tNum / tDen : 0;
    }

    const brokers = Array.from(
      new Set(lots.map(l => l.broker).filter((b): b is Broker => !!b)),
    );
    const hasUnspecifiedBroker = lots.some(l => !l.broker);

    result.push({
      id,
      symbol,
      currency,
      totalShares,
      mergedAvgCost,
      mergedPurchaseRate,
      mergedTargetReturn,
      lots,
      brokers,
      hasMultipleBrokers: brokers.length >= 2,
      hasUnspecifiedBroker,
    });
  }

  return result;
}

/**
 * 사용자 패턴 자동 추론 — 같은 종목 분산 보유가 1개라도 있으면 통합 뷰 디폴트.
 * 그 외엔 broker별 분리 디폴트 (페르소나 B 처럼 증권사별 다른 종목 패턴).
 */
export function inferDefaultViewMode(stocks: StockItem[]): 'merged' | 'separated' {
  const merged = mergeHoldings(stocks);
  return merged.some(h => h.hasMultipleBrokers) ? 'merged' : 'separated';
}
