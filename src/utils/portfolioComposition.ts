import { STOCK_KR, type QuoteData } from '@/config/constants';
import { convertStockAmount, convertStockCostAmount, type StockCurrency } from './stockCurrency';

export interface CompositionStock {
  symbol: string;
  currency?: StockCurrency;
  avgCost: number;
  shares: number;
  targetReturn: number;
  purchaseRate?: number;
}

/** Merge lots before calculating weights; unknown cost/price must not appear as zero return. */
export function buildComposition(stocks: CompositionStock[], quotes: Record<string, unknown>, rate: number, currency: 'KRW' | 'USD') {
  const entries = new Map<string, { symbol: string; label: string; value: number; cost: number; shares: number; knownCost: boolean; today: number | null }>();
  const missing = new Set<string>();
  for (const stock of stocks) {
    if (!(stock.shares > 0) || !Number.isFinite(stock.shares)) continue;
    const quote = quotes[stock.symbol] as QuoteData | undefined;
    if (!quote || !Number.isFinite(quote.c) || quote.c <= 0) { missing.add(stock.symbol); continue; }
    const current = convertStockAmount(stock.symbol, quote.c, rate, stock.currency);
    const cost = convertStockCostAmount(stock.symbol, stock.avgCost, rate, stock.purchaseRate, stock.currency);
    const value = (currency === 'KRW' ? current.krw : current.usd) * stock.shares;
    if (!Number.isFinite(value) || value <= 0) { missing.add(stock.symbol); continue; }
    const lotCost = (currency === 'KRW' ? cost.krw : cost.usd) * stock.shares;
    const knownCost = Number.isFinite(lotCost) && lotCost > 0;
    const existing = entries.get(stock.symbol);
    if (existing) {
      existing.value += value;
      existing.cost += knownCost ? lotCost : 0;
      existing.shares += stock.shares;
      existing.knownCost &&= knownCost;
    } else entries.set(stock.symbol, {
      symbol: stock.symbol, label: STOCK_KR[stock.symbol] || stock.symbol, value,
      cost: knownCost ? lotCost : 0, shares: stock.shares, knownCost,
      today: Number.isFinite(quote.dp) ? quote.dp : null,
    });
  }
  const total = [...entries.values()].reduce((sum, item) => sum + item.value, 0);
  return {
    total, missing: missing.size,
    items: [...entries.values()].sort((a, b) => b.value - a.value).map(item => ({
      ...item, weight: item.value / total * 100,
      pnl: item.knownCost ? (item.value - item.cost) / item.cost * 100 : null,
    })),
  };
}

/** Area remains proportional to value, including small holdings. Labels live outside narrow cells. */
export function layoutComposition<T extends { weight: number }>(items: T[], aspectRatio = 1.6): (T & { x: number; y: number; w: number; h: number })[] {
  const aspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1.6;
  const split = (group: T[], x: number, y: number, w: number, h: number): (T & { x: number; y: number; w: number; h: number })[] => {
    if (!group.length) return [];
    if (group.length === 1) return [{ ...group[0], x, y, w, h }];
    const total = group.reduce((sum, item) => sum + item.weight, 0);
    let index = 1;
    let first = group[0].weight;
    while (index < group.length - 1 && Math.abs(first + group[index].weight - total / 2) < Math.abs(first - total / 2)) first += group[index++].weight;
    const ratio = first / total;
    return w * aspect >= h
      ? [...split(group.slice(0, index), x, y, w * ratio, h), ...split(group.slice(index), x + w * ratio, y, w * (1 - ratio), h)]
      : [...split(group.slice(0, index), x, y, w, h * ratio), ...split(group.slice(index), x, y + h * ratio, w, h * (1 - ratio))];
  };
  return split(items.filter(item => Number.isFinite(item.weight) && item.weight > 0), 0, 0, 100, 100);
}
