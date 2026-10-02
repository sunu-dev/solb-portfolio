import { describe, expect, it } from 'vitest';
import { MARKET_GUIDES, type MarketGuideId } from '@/config/marketGuides';
import type { StockItem } from '@/config/constants';
import type { EconomicEvent } from '@/lib/economicEvents';
import { guideConnections, guideEvents } from '@/lib/guideConnections';

const guide = (id: MarketGuideId) => MARKET_GUIDES.find(item => item.id === id)!;
const stock = (symbol: string, extra: Partial<StockItem> = {}): StockItem => ({ symbol, avgCost: 100, shares: 1, targetReturn: 10, ...extra });
const now = Date.parse('2026-10-02T12:00:00Z');
const hour = 3600000;
const event = (key: string, offset: number, extra: Partial<EconomicEvent> = {}): EconomicEvent => ({
  key, kind: 'fomc', title: key, at: new Date(now + offset).toISOString(), timeKnown: true,
  sourceUrl: 'https://example.test/schedule', ...extra,
});
const result = { headline: '확인한 결과', sourceUrl: 'https://example.test/result' };

describe('guide holding connections', () => {
  it('deduplicates Korean symbols regardless of case, spaces or market suffix', () => {
    const source = [stock('005930'), stock(' 005930.ks '), stock('005930.KQ'), stock('aapl'), stock(' AAPL ')];
    const connected = guideConnections(guide('earnings'), source);
    expect(connected.map(item => item.symbol)).toEqual(['005930.KQ', 'AAPL']);
    expect(source[1].symbol).toBe(' 005930.ks ');
  });

  it('keeps sample holdings out of personal connections, including when duplicated after a real holding', () => {
    expect(guideConnections(guide('earnings'), [stock('aapl'), stock('AAPL', { demo: true }), stock('NVDA', { demo: true })]))
      .toEqual([stock('AAPL')]);
    expect(guideConnections(guide('earnings'), [stock('NVDA', { demo: true })])).toEqual([]);
  });

  it('filters dollar valuation context by actual currency, with Korean symbol currency taking precedence', () => {
    const connected = guideConnections(guide('currency'), [
      stock('AAPL'), stock('MSFT', { currency: 'USD' }), stock('UNKNOWN', { currency: 'KRW' }),
      stock('005930', { currency: 'USD' }), stock('247540.kq', { currency: 'USD' }),
    ]);
    expect(connected.map(item => item.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('does not display blank symbols as a personal stock connection', () => {
    expect(guideConnections(guide('earnings'), [stock('  '), stock('AAPL')]).map(item => item.symbol)).toEqual(['AAPL']);
  });

  it('includes watchlist entries with no purchase information and excludes Korean symbols from US context', () => {
    const connected = guideConnections(guide('inflation'), [
      stock('aapl', { avgCost: 0, shares: 0 }), stock('005930'), stock('247540.KQ'),
    ]);
    expect(connected.map(item => item.symbol)).toEqual(['AAPL']);
  });
});

describe('guide economic event connections', () => {
  it('selects the latest confirmed relevant result and earliest upcoming event without mutating input', () => {
    const later = event('later', 3 * hour);
    const latest = event('latest', -hour, { result });
    const next = event('next', hour);
    const source = [later, event('irrelevant', -hour / 2, { kind: 'cpi', result }), event('pending', -100), latest,
      event('old', -8 * 24 * hour, { result }), event('korean-rate-decision', hour / 2, { kind: 'bok' }), next];
    const original = [...source];
    expect(guideEvents(guide('rates'), source, now)).toEqual({ recent: latest, upcoming: next });
    expect(source).toEqual(original);
  });

  it('does not present a future result as already released, including date-only earnings', () => {
    const future = event('future', hour, { kind: 'earnings', timeKnown: false, result, symbol: 'AAPL' });
    expect(guideEvents(guide('earnings'), [future], now)).toEqual({ recent: undefined, upcoming: future });
  });

  it('ignores invalid dates even when earnings results have no known release time', () => {
    const invalid = event('invalid', 0, { kind: 'earnings', timeKnown: false, result, at: 'not-a-date' });
    expect(guideEvents(guide('earnings'), [invalid], now)).toEqual({ recent: undefined, upcoming: undefined });
  });

  it('returns no current events before the client clock is initialized or for an invalid clock', () => {
    const release = event('released', -hour, { result });
    expect(guideEvents(guide('rates'), [release], 0)).toEqual({ recent: undefined, upcoming: undefined });
    expect(guideEvents(guide('rates'), [release], Number.NaN)).toEqual({ recent: undefined, upcoming: undefined });
  });

  it('does not relabel elapsed pending data as a result and expires a result after seven days', () => {
    const expired = event('expired', -7 * 24 * hour, { result });
    expect(guideEvents(guide('rates'), [expired, event('pending', -hour)], now))
      .toEqual({ recent: undefined, upcoming: undefined });
  });
});
