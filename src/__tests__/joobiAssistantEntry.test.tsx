import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import JoobiAssistantLauncher from '@/components/learning/JoobiAssistantLauncher';

const state = vi.hoisted(() => ({
  now: Date.parse('2026-11-05T03:00:00Z'),
  stocks: { investing: [] as { symbol: string; demo?: boolean }[], watching: [] as { symbol: string; demo?: boolean }[] },
}));
vi.mock('@/hooks/useNow', () => ({ useNow: () => state.now }));
vi.mock('@/store/portfolioStore', () => ({ usePortfolioStore: (select: (value: typeof state) => unknown) => select(state) }));
afterEach(() => {
  state.now = Date.parse('2026-11-05T03:00:00Z');
  state.stocks = { investing: [], watching: [] };
});

describe('discoverable Joobi entry and relevant clock notices', () => {
  it('shows the default character and a named dialog button before any question is opened', () => {
    const html = renderToStaticMarkup(<JoobiAssistantLauncher />);
    expect(html).toContain('sprout-avatar-v1.png');
    expect(html).toContain('주비에게 물어보기');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('늦어졌어요');
  });
  it('announces the clock change while reading a US stock, even without a holding', () => {
    const html = renderToStaticMarkup(<JoobiAssistantLauncher symbol="MU" name="마이크론" inline />);
    expect(html).toContain('미국 정규장 시간이 한 시간 늦어졌어요');
    state.now = Date.parse('2026-11-12T03:00:00Z');
    const later = renderToStaticMarkup(<JoobiAssistantLauncher symbol="MU" name="마이크론" inline />);
    expect(later).not.toContain('늦어졌어요');
    expect(later).toContain('마이크론, 어떤 점이 궁금하세요?');
  });
  it('keeps a Korean detail about that stock even when the portfolio also contains US stocks', () => {
    state.stocks.investing = [{ symbol: 'MU' }];
    const html = renderToStaticMarkup(<JoobiAssistantLauncher symbol="340810.KQ" name="시선AI" inline />);
    expect(html).toContain('시선AI, 어떤 점이 궁금하세요?');
    expect(html).not.toContain('늦어졌어요');
    expect(renderToStaticMarkup(<JoobiAssistantLauncher />)).toContain('늦어졌어요');
  });
  it('includes an actual US watchlist, excludes sample records, and waits for the browser clock', () => {
    state.stocks.watching = [{ symbol: 'SOXL', demo: true }];
    expect(renderToStaticMarkup(<JoobiAssistantLauncher />)).not.toContain('늦어졌어요');
    state.stocks.watching = [{ symbol: 'SOXL' }];
    expect(renderToStaticMarkup(<JoobiAssistantLauncher />)).toContain('늦어졌어요');
    state.now = 0;
    expect(renderToStaticMarkup(<JoobiAssistantLauncher />)).not.toContain('늦어졌어요');
  });
});
