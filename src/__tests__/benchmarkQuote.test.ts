import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const fixture = vi.hoisted(() => ({
  stocks: { investing: [{ symbol: 'AAPL', shares: 1, avgCost: 80 }] },
  dailySnapshots: [],
  macroData: {
    AAPL: { c: 100, d: 1, dp: 1 },
    'USD/KRW': { value: 1335 },
    'S&P 500': { value: 6000, changePercent: null as number | null },
  },
}));
vi.mock('@/store/portfolioStore', () => ({ usePortfolioStore: () => fixture }));
import BenchmarkCompare from '@/components/portfolio/BenchmarkCompare';

beforeEach(() => { fixture.macroData['S&P 500'].changePercent = null; });
it('does not invent a zero-percent market or excess return from an unknown comparison', () => {
  expect(renderToStaticMarkup(createElement(BenchmarkCompare))).toBe('');
});
it('still compares the portfolio against a confirmed unchanged market', () => {
  fixture.macroData['S&P 500'].changePercent = 0;
  const html = renderToStaticMarkup(createElement(BenchmarkCompare));
  expect(html).toContain('오늘 시장 대비');
  expect(html).toContain('0.00%');
});
