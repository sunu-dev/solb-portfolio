import type { QuoteData, StockItem } from '@/config/constants';
import { getStockIdentityKey, summarizePortfolioCurrency } from '@/utils/stockCurrency';

/** 공유 수치는 실제 보유와 샘플을 섞지 않고, 시세가 확인된 종목만 계산한다. */
export function buildPortfolioShareSummary(stocks: StockItem[], quotes: Record<string, unknown>, usdKrw: number) {
  const holdings = stocks.filter(stock => stock.avgCost > 0 && stock.shares > 0);
  const realHoldings = holdings.filter(stock => !stock.demo);
  const isSample = realHoldings.length === 0 && holdings.length > 0;
  const selected = isSample ? holdings : realHoldings;
  const grouped = new Map<string, { cost: number; pnl: number; complete: boolean }>();

  for (const stock of selected) {
    const key = getStockIdentityKey(stock.symbol);
    const group = grouped.get(key) ?? { cost: 0, pnl: 0, complete: true };
    const quote = quotes[stock.symbol] as QuoteData | undefined;
    if (!quote || !Number.isFinite(quote.c) || quote.c <= 0) {
      group.complete = false;
    } else {
      const amounts = summarizePortfolioCurrency([{ ...stock, currentPrice: quote.c }], usdKrw);
      group.cost += amounts.totalCostKrw;
      group.pnl += amounts.totalPnlKrw;
    }
    grouped.set(key, group);
  }

  const priced = [...grouped.values()].filter(group => group.complete && group.cost > 0);
  const totalCost = priced.reduce((sum, group) => sum + group.cost, 0);
  const totalPnl = priced.reduce((sum, group) => sum + group.pnl, 0);
  const gainCount = priced.filter(group => group.pnl > 0).length;

  return {
    isSample,
    sampleExcluded: !isSample && holdings.some(stock => stock.demo),
    holdingCount: grouped.size,
    quotedHoldingCount: priced.length,
    missingQuoteCount: grouped.size - priced.length,
    totalPnlPct: totalCost > 0 ? totalPnl / totalCost * 100 : null,
    gainCount,
    gainRatio: priced.length > 0 ? Math.round(gainCount / priced.length * 100) : null,
  };
}
