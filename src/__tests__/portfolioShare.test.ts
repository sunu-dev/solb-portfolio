import { describe, expect, it } from 'vitest';
import type { StockItem } from '@/config/constants';
import { buildPortfolioShareSummary } from '@/lib/portfolioShare';

const holding = (symbol: string, overrides: Partial<StockItem> = {}): StockItem => ({ symbol, avgCost: 100, shares: 1, targetReturn: 0, ...overrides });

describe('portfolio sharing data boundaries', () => {
  it('excludes sample positions when real holdings exist', () => {
    const result = buildPortfolioShareSummary([holding('AAPL'), holding('NVDA', { demo: true })], { AAPL: { c: 110 }, NVDA: { c: 500 } }, 1400);
    expect(result).toMatchObject({ isSample: false, sampleExcluded: true, holdingCount: 1, totalPnlPct: 10 });
  });

  it('marks a sample-only portfolio as a sample', () => {
    expect(buildPortfolioShareSummary([holding('AAPL', { demo: true })], { AAPL: { c: 110 } }, 1400)).toMatchObject({ isSample: true, sampleExcluded: false });
  });

  it('does not count missing prices as losing positions', () => {
    expect(buildPortfolioShareSummary([holding('AAPL'), holding('MSFT')], { AAPL: { c: 110 } }, 1400)).toMatchObject({ holdingCount: 2, quotedHoldingCount: 1, missingQuoteCount: 1, gainRatio: 100, totalPnlPct: 10 });
  });

  it('combines the same company across brokers before counting profitable stocks', () => {
    const result = buildPortfolioShareSummary([holding('AAPL', { avgCost: 80, broker: 'toss' }), holding('AAPL', { avgCost: 120, broker: 'kis' })], { AAPL: { c: 100 } }, 1400);
    expect(result).toMatchObject({ holdingCount: 1, quotedHoldingCount: 1, gainCount: 0, gainRatio: 0, totalPnlPct: 0 });
  });

  it('uses the same KRW basis for return and profitable-stock counts', () => {
    const result = buildPortfolioShareSummary([holding('AAPL', { purchaseRate: 1600 })], { AAPL: { c: 110 } }, 1400);
    expect(result.totalPnlPct).toBeLessThan(0);
    expect(result.gainRatio).toBe(0);
  });

  it('keeps unavailable return distinct from a zero return', () => {
    expect(buildPortfolioShareSummary([holding('AAPL')], {}, 1400)).toMatchObject({ quotedHoldingCount: 0, totalPnlPct: null, gainRatio: null });
  });
});
