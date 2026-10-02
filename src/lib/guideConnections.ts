import type { StockItem } from '@/config/constants';
import type { MarketGuide } from '@/config/marketGuides';
import { getStockCurrency, getStockIdentityKey, isKoreanStockSymbol } from '@/utils/stockCurrency';
import { recentResults, type EconomicEvent } from '@/lib/economicEvents';

/** Context for questions, not a claim about a company's exposure or price direction. */
export function guideConnections(guide: MarketGuide, stocks: StockItem[]) {
  const unique = new Map<string, StockItem>();
  for (const stock of stocks) {
    if (stock.demo) continue;
    const symbol = stock.symbol.trim().toUpperCase();
    if (!symbol) continue;
    const matches = guide.connection === 'usd-value' ? getStockCurrency(symbol, stock.currency) === 'USD'
      : guide.connection === 'us-market' ? !isKoreanStockSymbol(symbol)
      : true;
    if (matches) unique.set(getStockIdentityKey(symbol), { ...stock, symbol });
  }
  return [...unique.values()];
}

export function guideEvents(guide: MarketGuide, events: EconomicEvent[], now: number) {
  if (now <= 0 || !Number.isFinite(new Date(now).getTime())) return { recent: undefined, upcoming: undefined };
  const relevant = events.filter(event => Number.isFinite(Date.parse(event.at)) && guide.eventKinds.includes(event.kind));
  return {
    recent: recentResults(relevant.filter(event => Date.parse(event.at) <= now), now)[0],
    upcoming: relevant.filter(event => Date.parse(event.at) > now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0],
  };
}
