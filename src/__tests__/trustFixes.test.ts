import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBrief, buildPushPayload, buildEmailBody } from '@/lib/digestBrief';
import { companyNewsQuery } from '@/lib/newsFeed';
import { companyNewsIdentity } from '@/lib/companyNewsIdentity';
import { eventPriceComparison } from '@/utils/eventPriceComparison';
import { trackWatchSources } from '@/lib/watchSourceHealth';
import { DISCOVERY_SIGNALS } from '@/config/stockQuestions';
import { newsExploration } from '@/lib/contextExploration';
import type { PortfolioStocks } from '@/config/constants';
const holdings: PortfolioStocks = { investing: [{ symbol: 'MSFT', shares: 2, avgCost: 90, targetReturn: 10 }], watching: [], sold: [] };
afterEach(() => vi.useRealTimers());

describe('digest valuation truth', () => {
  it('never produces a KRW valuation or gain from a missing exchange rate', async () => {
    const brief = (await buildBrief(holdings, [], null, { MSFT: { c: 100, d: 5, dp: 5.26 } }, 'morning'))!;
    expect(brief.totalValue).toBeNull(); expect(brief.todayDelta).toBeNull();
    expect(buildPushPayload(brief, 'morning').body).toContain('환율');
    expect(buildEmailBody(brief, '제목', '본문', 'https://joobi.kr')).toContain('현재 평가액: 미확인');
    expect(buildEmailBody(brief, '제목', '본문', 'https://joobi.kr')).not.toContain('1400');
  });
  it('does not present a partially priced portfolio as the whole valuation', async () => {
    const stocks = { ...holdings, investing: [...holdings.investing, { symbol: 'AAPL', shares: 1, avgCost: 100, targetReturn: 10 }] };
    const brief = (await buildBrief(stocks, [], 1300, { MSFT: { c: 100, d: 5, dp: 5.26 }, AAPL: null }, 'morning'))!;
    expect(brief.totalValue).toBeNull(); expect(brief.dataNote).toContain('일부 종목 시세');
  });
  it('can value KRW-only holdings when USD exchange rates are missing', async () => {
    const stocks = { ...holdings, investing: [{ symbol: '005930.KS', shares: 2, avgCost: 90000, targetReturn: 10 }] };
    expect(await buildBrief(stocks, [], null, { '005930.KS': { c: 100000, d: 1000, dp: 1.01 } }, 'close')).toMatchObject({ totalValue: 200000, todayDelta: 2000 });
  });
  it('compares total shares across duplicate broker positions without reusing one matching row', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
    const stock = holdings.investing[0];
    const stocks = { ...holdings, investing: [stock, stock] };
    const snapshot = { date: '2026-10-21', schemaVersion: 2 as const, valuationCurrency: 'KRW' as const, totalValue: 500, totalCost: 450, totalValueKrw: 650000, totalCostKrw: 585000, stocks: [
      { symbol: 'MSFT', shares: 2, avgCost: 90, currentPrice: 100 },
      { symbol: 'MSFT', shares: 3, avgCost: 90, currentPrice: 100 },
    ] };
    const prices = { MSFT: { c: 100, d: 5, dp: 5.26 } };
    expect((await buildBrief(stocks, [snapshot], 1300, prices, 'morning'))?.yesterdayDelta).toBeNull();
    const merged = { ...snapshot, stocks: [{ ...snapshot.stocks[0], shares: 4 }] };
    expect((await buildBrief(stocks, [merged], 1300, prices, 'morning'))?.yesterdayDelta).toBe(-130000);
  });
  it('uses no earlier-day snapshot as yesterday and excludes position changes from the delta', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
    const snapshot = { date: '2026-10-20', schemaVersion: 2 as const, valuationCurrency: 'KRW' as const, totalValue: 100, totalCost: 90, totalValueKrw: 130000, totalCostKrw: 117000, stocks: [{ symbol: 'MSFT', shares: 1, avgCost: 90, currentPrice: 100 }] };
    const prices = { MSFT: { c: 100, d: 5, dp: 5.26 } };
    expect((await buildBrief(holdings, [snapshot], 1300, prices, 'morning'))?.yesterdayDelta).toBeNull();
    expect((await buildBrief(holdings, [{ ...snapshot, date: '2026-10-21' }], 1300, prices, 'morning'))?.yesterdayDelta).toBeNull();
  });
});

describe('company-specific news', () => {
  it('uses a common seven-day query without the Korean exchange suffix', () => {
    expect(companyNewsQuery('005930.KS')).toEqual({ symbol: '005930.KS', locale: 'ko', maxHours: 168 });
    expect(companyNewsQuery('166480.KQ', '166480.KQ')).toEqual({ symbol: '166480.KQ', locale: 'ko', maxHours: 168 });
  });
  it('accepts an exact company alias but not a different Samsung affiliate', () => {
    const identity = companyNewsIdentity('005930.KS', 'Samsung Electronics');
    expect(identity.matches('Samsung Electronics posts earnings')).toBe(true);
    expect(identity.matches('삼성전자, 반도체 수출 증가')).toBe(true);
    expect(identity.matches('삼성SDI 배터리 수주')).toBe(false);
    expect(identity.queries).toEqual(['삼성전자 주가', '"Samsung Electronics"']);
  });
  it('does not match a short ticker as an ordinary word', () => {
    const identity = companyNewsIdentity('ON');
    expect(identity.matches('Stocks rise on rate cuts')).toBe(false);
    expect(identity.matches('NASDAQ: ON announces results')).toBe(true);
  });
  it('does not mistake a dollar-denominated deal for an exchange-rate event', () => {
    const title = '마이크로소프트 113억 달러 투자 발표';
    expect(DISCOVERY_SIGNALS.fx.test(title)).toBe(false);
    expect(newsExploration(title)).not.toContain('currency');
    expect(DISCOVERY_SIGNALS.fx.test('달러 강세에 원화 약세, 수입 비용 부담')).toBe(true);
  });
});

describe('historical baseline dates', () => {
  const t = ['2026-02-26','2026-02-27','2026-03-02'].map(date => Date.parse(date) / 1000);
  it('uses the last close on or before a weekend basis date, and displays that actual date', () => {
    expect(eventPriceComparison({ t, c: [100, 110, 99] }, false, undefined, '2026-02-28')).toMatchObject({ basePrice: 110, baseDate: '2026-02-27', lastDate: '2026-03-02', lastPrice: 99 });
  });
  it('does not substitute an IPO price after the requested basis date', () => {
    expect(eventPriceComparison({ t, c: [100, 110, 99] }, false, undefined, '2026-02-25')).toBeNull();
  });
});

describe('persistent source health', () => {
  const first = '2026-10-22T00:00:00Z';
  const source = { id: 'krx', label: 'KRX', available: 0, total: 1, checkedAt: first };
  it('preserves the last good observation, alerts after sustained failure, and resets on recovery', () => {
    const good = trackWatchSources([{ ...source, available: 1 }], [], first).coverage;
    const failed = trackWatchSources([source], good, first).coverage;
    const lasting = trackWatchSources([source], failed, '2026-10-22T00:40:00Z');
    expect(lasting.alerts).toEqual(['krx']); expect(lasting.coverage[0].lastSuccessAt).toBe(first);
    expect(trackWatchSources([source], lasting.coverage, '2026-10-22T00:50:00Z').alerts).toEqual([]);
    const recovered = trackWatchSources([{ ...source, available: 1 }], lasting.coverage, '2026-10-22T01:00:00Z').coverage[0];
    expect(recovered.consecutiveFailures).toBe(0); expect(recovered).not.toHaveProperty('failureSince');
  });
});
