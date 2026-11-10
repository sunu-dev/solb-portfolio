import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StockItem, QuoteData, MacroEntry } from '@/config/constants';
import { holdingPrice, holdingTotals, mergeHoldings } from '@/utils/mergedHoldings';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } } }));
vi.mock('@/hooks/useNow', () => ({ useNow: () => Date.parse('2026-11-03T05:00:00Z') }));
vi.mock('@/store/portfolioStore', async () => {
  const actual = await vi.importActual<typeof import('@/store/portfolioStore')>('@/store/portfolioStore');
  const store = actual.usePortfolioStore;
  return { ...actual, usePortfolioStore: Object.assign((selector: (state: ReturnType<typeof store.getState>) => unknown) => selector(store.getState()), store) };
});
import BrokerSummaryCard from '@/components/portfolio/BrokerSummaryCard';
import MergedHoldingsCard from '@/components/portfolio/MergedHoldingsCard';
import Dashboard from '@/components/portfolio/Dashboard';
import { usePortfolioStore } from '@/store/portfolioStore';

const original = usePortfolioStore.getState();
afterEach(() => usePortfolioStore.setState(original));
const stock = (overrides: Partial<StockItem> = {}): StockItem => ({ symbol: 'AAPL', name: '애플', shares: 1, avgCost: 10, targetReturn: 0, ...overrides });
const quote = (c: number, d = 0): QuoteData => ({ c, d, dp: c - d > 0 ? d / (c - d) * 100 : 0, h: c, l: c, o: c, pc: c - d, t: 1793678400 });
const fx: MacroEntry = { value: 1300, change: 0, changePercent: 0 };
function screen(holdings: StockItem[], quotes: Record<string, QuoteData | MacroEntry> = {}, currency: 'KRW' | 'USD' = 'KRW') {
  usePortfolioStore.setState({ stocks: { investing: holdings, watching: [], sold: [] }, macroData: quotes, currency, alerts: [], rawCandles: {} });
}

describe('real quantities and complete arithmetic across brokers', () => {
  it('weights prices by quantity, preserves original registrations and separates currencies', () => {
    const lots = [stock({ broker: 'toss' }), stock({ symbol: ' aapl ', shares: 3, avgCost: 20, broker: 'kiwoom' })];
    const merged = mergeHoldings(lots);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ totalShares: 4, mergedAvgCost: 17.5, hasMultipleBrokers: true, currency: 'USD' });
    expect(merged[0].lots).toEqual(lots); expect(lots[1].symbol).toBe(' aapl ');
    expect(mergeHoldings([...lots, stock({ currency: 'KRW' })])).toHaveLength(2);
  });
  it('never treats a missing purchase price as zero when averaging', () => {
    const merged = mergeHoldings([stock(), stock({ shares: 3, avgCost: 0 })])[0];
    expect(merged.totalShares).toBe(4); expect(merged.mergedAvgCost).toBeNull();
    expect(merged.hasMultipleBrokers).toBe(false);
  });
  it('recognizes Korean aliases and actual unique stocks across registrations', () => {
    const lots = [stock({ symbol: '005930', currency: 'USD', avgCost: 50000 }), stock({ symbol: '005930.KS', shares: 2, avgCost: 65000 })];
    expect(mergeHoldings(lots)[0]).toMatchObject({ currency: 'KRW', totalShares: 3, mergedAvgCost: 60000 });
    expect(holdingTotals(lots, { '005930.KS': quote(70000) })).toMatchObject({ value: 210000, cost: 180000, pnl: 30000, count: 1 });
    expect(holdingPrice(' 005930 ', { '005930.KS': quote(70000) })).toBe(70000);
  });
  it('keeps known current value when cost is missing, but never invents a return', () => {
    expect(holdingTotals([stock({ avgCost: 0 })], { AAPL: quote(20) }, 'USD')).toMatchObject({ value: 20, cost: null, pnl: null, pnlPct: null, missingCosts: 1 });
  });
  it('never substitutes purchase price for a missing or invalid quote', () => {
    for (const c of [0, -1, NaN, Infinity]) {
      expect(holdingTotals([stock()], { AAPL: { c } }, 'USD')).toMatchObject({ value: null, cost: 10, pnl: null, pnlPct: null });
    }
    expect(holdingPrice('AAPL', {})).toBeNull();
  });
  it('does not present a partial value as the whole portfolio', () => {
    const result = holdingTotals([stock(), stock({ symbol: 'MSFT' })], { AAPL: quote(20) }, 'USD');
    expect(result).toMatchObject({ value: null, cost: 20, pnl: null, missingPrices: 1, count: 2 });
  });
  it('requires current FX only when conversion is necessary', () => {
    const usd = [stock({ purchaseRate: 1200 })];
    expect(holdingTotals(usd, { AAPL: quote(20) })).toMatchObject({ value: null, cost: 12000, pnl: null, missingFx: true });
    expect(holdingTotals(usd, { AAPL: quote(20) }, 'USD')).toMatchObject({ value: 20, cost: 10, pnl: 10, missingFx: false });
    expect(holdingTotals([stock({ symbol: '005930.KS', avgCost: 10 })], { '005930.KS': quote(20) })).toMatchObject({ value: 20, cost: 10, pnl: 10 });
    expect(holdingTotals([stock({ symbol: '005930.KS' })], { '005930.KS': quote(20) }, 'USD').value).toBeNull();
  });
  it('does not substitute current FX for unknown purchase FX in won returns', () => {
    const result = holdingTotals([stock()], { AAPL: quote(20), 'USD/KRW': fx });
    expect(result).toMatchObject({ value: 26000, cost: null, pnl: null, missingPurchaseRates: 1 });
    expect(holdingTotals([stock({ purchaseRate: 1000 })], { AAPL: quote(20), 'USD/KRW': fx })).toMatchObject({ value: 26000, cost: 10000, pnl: 16000, pnlPct: 160 });
  });
  it('excludes samples, zero/invalid quantities and does not fabricate daily changes', () => {
    const lots = [stock(), stock({ demo: true }), stock({ shares: 0 }), stock({ shares: NaN }), stock({ shares: Infinity }), stock({ shares: -1 })];
    expect(mergeHoldings(lots)[0].totalShares).toBe(1);
    expect(holdingTotals(lots, { AAPL: quote(20, 2) }, 'USD')).toMatchObject({ value: 20, dayChange: 2 });
    expect(holdingTotals(lots, { AAPL: { c: 20 } }, 'USD').dayChange).toBeNull();
    expect(holdingTotals([], {}, 'USD')).toMatchObject({ value: null, cost: null, pnl: null, count: 0 });
  });
});

describe('visible explanations and unknown values', () => {
  it('shows missing information rather than 0% in broker summaries and merged records', () => {
    screen([stock({ broker: 'toss' }), stock({ broker: 'kiwoom', avgCost: 0 })]);
    const broker = renderToStaticMarkup(<BrokerSummaryCard active="toss" onSelect={() => {}} />);
    const merged = renderToStaticMarkup(<MergedHoldingsCard />);
    expect(broker).toContain('시세 확인 필요'); expect(broker).toContain('aria-pressed="true"');
    expect(merged).toContain('매수가 입력 필요'); expect(merged).toContain('시세 확인 필요');
    expect(merged).toContain('2건 등록'); expect(merged).not.toContain('2개 증권사');
    expect(merged).toContain('애플 설명 읽기'); expect(merged).toContain('href=');
    expect(broker + merged).not.toContain('0.0%'); expect(merged).toContain('17.5달러');
  });
  it('preserves dollar values without FX, reveals all original broker quantities and costs', () => {
    screen([stock({ broker: 'toss' }), stock({ broker: 'kiwoom', shares: 3, avgCost: 20 })], { AAPL: quote(20) });
    const html = renderToStaticMarkup(<MergedHoldingsCard />);
    for (const expected of ['4주', '1주', '3주', '$17.50', '$80.00', '$10.00', '$20.00', '토스증권', '키움증권', '환율 변동']) expect(html).toContain(expected);
    expect(html).toContain('<details'); expect(html).not.toContain('title=');
  });
  it('keeps main evaluation value without a purchase price and explains absent profit', () => {
    screen([stock({ avgCost: 0 })], { AAPL: quote(20) }, 'USD');
    const html = renderToStaticMarkup(<Dashboard />);
    expect(html).toContain('내 주식 평가금액'); expect(html).toContain('$20');
    expect(html).toContain('매수가가 비어 있어요'); expect(html).not.toContain('profit-total');
    expect(html).not.toContain('종목을 추가하면 수익 현황');
  });
  it('withholds the incomplete whole value but keeps a known purchase total and holding count', () => {
    screen([stock(), stock({ symbol: 'MSFT' })], { AAPL: quote(20) }, 'USD');
    const html = renderToStaticMarkup(<Dashboard />);
    expect(html).toContain('시세를 확인하지 못한 종목'); expect(html).not.toContain('assetValue');
    expect(html).toContain('투자 원금'); expect(html).toContain('$20'); expect(html).toContain('2개');
    expect(html).not.toContain('profit-total');
  });
  it('keeps samples out of real totals but labels a sample-only dashboard', () => {
    screen([stock({ shares: 2 }), stock({ symbol: 'MSFT', demo: true, shares: 100 })], { AAPL: quote(20), MSFT: quote(500) }, 'USD');
    expect(renderToStaticMarkup(<Dashboard />)).toContain('$40');
    screen([stock({ demo: true })], { AAPL: quote(20) }, 'USD');
    expect(renderToStaticMarkup(<Dashboard />)).toContain('샘플 주식 평가금액');
  });
  it('shows native dollar returns when purchase FX is absent and refuses fake won returns', () => {
    screen([stock()], { AAPL: quote(20), 'USD/KRW': fx });
    const won = renderToStaticMarkup(<Dashboard />);
    expect(won).toContain('매수 환율'); expect(won).not.toContain('profit-total');
    usePortfolioStore.setState({ currency: 'USD' });
    const dollar = renderToStaticMarkup(<Dashboard />);
    expect(dollar).toContain('profit-total'); expect(dollar).toContain('100.00%');
  });
});
