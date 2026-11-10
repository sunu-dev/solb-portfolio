import { describe, expect, it } from 'vitest';
import { buildMarketFlowBriefs } from '@/lib/marketFlowEngine';
import { WATCH_TARGETS } from '@/config/marketWatch';
import type { WatchEvent, WatchRun } from '@/lib/marketWatch';

const now = Date.parse('2026-10-31T02:30:00Z');
const stamp = '2026-10-30T20:00:00Z';
const runs: WatchRun[] = [{ scope: 'market', checkedAt: new Date(now).toISOString(), coverage: [], warnings: [] }];
function move(symbol: string, change: number, asOf = stamp): WatchEvent {
  const target = WATCH_TARGETS.find(item => item.symbol === symbol)!;
  return { id: `quote:${symbol}`, kind: 'move', market: target.market, title: target.label, summary: '',
    meaning: '', path: [], watch: '', limits: '', sectors: target.sectors, status: 'observed', priority: 0,
    asOf, fingerprint: `${symbol}:${change}`, firstSeenAt: asOf, updatedAt: asOf, lastObservedAt: asOf, history: [],
    sources: [{ label: 'fixture', url: 'https://finance.yahoo.com/', at: asOf }],
    measure: { symbol, change, unit: '%', date: asOf.slice(0, 10) } };
}
function selloff() {
  return [move('^GSPC', -1.82), move('^IXIC', -2.86), move('INTC', -28.6), move('AMZN', -1.4),
    ...['XLK', 'XLC', 'XLY', 'XLP', 'XLE', 'XLF', 'XLV', 'XLI', 'XLB', 'XLRE', 'XLU'].map((s, i) => move(s, -0.1 - i * .3))];
}
describe('evidence-led market flow engine', () => {
  it('joins market, industry breadth and exceptional company moves without claiming one universal cause', () => {
    const [brief] = buildMarketFlowBriefs(selloff(), runs, now);
    expect(brief.sessionDate).toBe('2026-10-30');
    expect(brief.severity).toBe('large-move');
    expect(brief.pattern).toBe('decline');
    expect(brief.breadth).toEqual({ available: 11, total: 11, declining: 11, advancing: 0 });
    expect(brief.companies[0]).toMatchObject({ symbol: 'INTC', relativeToIndex: -26.78 });
    expect(brief.evidence).toHaveLength(2);
    expect(brief.sectorExplanation).toContain('상대적으로 강한 쪽도 하락');
    expect(brief.summary).toContain('여러 업종');
  });
  it('does not count the semiconductor ETF twice in broad industry coverage', () => {
    const [brief] = buildMarketFlowBriefs([...selloff(), move('SOXX', -8.24)], runs, now);
    expect(brief.breadth?.available).toBe(11);
  });
  it('keeps quiet observations in the denominator and deduplicates identical observations', () => {
    const events = selloff(); events.push(...events);
    expect(buildMarketFlowBriefs(events, runs, now)[0].breadth?.available).toBe(11);
  });
  it('does not compare different sessions or invent a missing index', () => {
    expect(buildMarketFlowBriefs([move('^GSPC', -1), move('^IXIC', -2, '2026-10-29T20:00:00Z')], runs, now)).toEqual([]);
    expect(buildMarketFlowBriefs([move('^GSPC', -1)], runs, now)).toEqual([]);
  });
  it('does not mix early-session sectors or indexes with later intraday prices', () => {
    const early = '2026-10-30T14:00:00Z'; const late = '2026-10-30T17:00:00Z';
    expect(buildMarketFlowBriefs([move('^GSPC', -1, late), move('^IXIC', -2, early)], runs, now)).toEqual([]);
    const [brief] = buildMarketFlowBriefs([move('^GSPC', -1, late), move('^IXIC', -2, late), move('XLK', -6, early)], runs, now);
    expect(brief.breadth?.available).toBe(0);
  });
  it('ignores previous-session company crashes when explaining the current session', () => {
    const [brief] = buildMarketFlowBriefs([...selloff(), move('GOOGL', -12.6, '2026-10-29T20:00:00Z')], runs, now);
    expect(brief.companies.some(item => item.symbol === 'GOOGL')).toBe(false);
  });
  it('fails closed on contradictory values at the same timestamp', () => {
    expect(buildMarketFlowBriefs([...selloff(), move('^IXIC', 3)], runs, now)).toEqual([]);
  });
  it('rejects nonfinite, future and undated values', () => {
    for (const invalid of [move('^IXIC', NaN), move('^IXIC', -3, '2026-11-01T20:00:00Z'),
      { ...move('^IXIC', -3), measure: { ...move('^IXIC', -3).measure!, date: '2026-10-29' } }]) {
      expect(buildMarketFlowBriefs([move('^GSPC', -1), invalid], runs, now)).toEqual([]);
    }
  });
  it('does not treat one falling sector as widespread weakness', () => {
    const [brief] = buildMarketFlowBriefs([move('^GSPC', -1.8), move('^IXIC', -2.8), move('XLK', -5)], runs, now);
    expect(brief.summary).not.toContain('여러 업종');
    expect(brief.sectorExplanation).toBeNull();
  });
  it('separates Korean index observations from US sector proxies', () => {
    const kr = [move('^KS11', -3.48, '2026-10-30T06:30:00Z'), move('^KQ11', -3.83, '2026-10-30T06:30:00Z')];
    const brief = buildMarketFlowBriefs([...selloff(), ...kr], runs, now).find(item => item.market === 'kr')!;
    expect(brief.breadth).toBeNull(); expect(brief.evidence).toEqual([]); expect(brief.companies).toEqual([]);
  });
  it('shows old data as delayed, and does not reuse dated explanations for another day', () => {
    expect(buildMarketFlowBriefs(selloff(), [], now)[0].freshness).toBe('delayed');
    const next = selloff().map(e => move(e.measure!.symbol, e.measure!.change, '2026-11-02T21:00:00Z'));
    expect(buildMarketFlowBriefs(next, [], Date.parse('2026-11-03T01:00:00Z'))[0].explanationState).toBe('awaiting-evidence');
    expect(buildMarketFlowBriefs(selloff(), runs, now + 5 * 86400000)).toEqual([]);
  });
  it('does not label a small same-direction session as conflicting directions', () => {
    const [brief] = buildMarketFlowBriefs([move('^GSPC', .1), move('^IXIC', .2)], runs, now);
    expect(brief.headline).toContain('변화가 크지');
    expect(brief.severity).toBe('ordinary');
  });
  it('does not promote related headlines to causal evidence', () => {
    const news = { ...move('INTC', -28.6), kind: 'market-news' as const, status: 'reported' as const,
      sources: [{ title: '급락 원인 확정이라는 미검증 제목', label: 'fixture', url: 'https://example.com/news', at: stamp }] };
    const [brief] = buildMarketFlowBriefs([...selloff(), news], runs, now, []);
    expect(brief.evidence).toEqual([]); expect(brief.explanationState).toBe('awaiting-evidence');
    expect(brief.relatedNews).toHaveLength(1);
  });
});
