import { describe, expect, it } from 'vitest';
import type { StockItem } from '@/config/constants';
import type { EconomicEvent } from '@/lib/economicEvents';
import { nextRelatedEvent, recentPersonalResults, stockGuideConnections } from '@/lib/guideConnections';

const now = Date.parse('2026-10-04T12:00:00Z');
const hour = 3600000;
const stock = (symbol: string, extra: Partial<StockItem> = {}): StockItem => ({ symbol, avgCost: 0, shares: 0, targetReturn: 0, ...extra });
const event = (key: string, offset: number, extra: Partial<EconomicEvent> = {}): EconomicEvent => ({
  key, kind: 'cpi', title: key, at: new Date(now + offset).toISOString(), timeKnown: true,
  sourceUrl: 'https://example.test/schedule', ...extra,
});
const result = { headline: '확인된 결과', sourceUrl: 'https://example.test/result' };

describe('evidence-backed personal report connections', () => {
  it('connects a verified business without presenting its pathway as an observed result', () => {
    const [connection] = stockGuideConnections('rates', [stock('TSLA')], event('fomc', -hour, { kind: 'fomc', result }));
    expect(connection.level).toBe('company');
    expect(connection.evidence?.source.url).toContain('sec.gov/Archives/');
    expect(connection.path).toContain('할부');
    expect(connection.condition).toContain('보장하지');
    expect(connection.watch).toContain('다음 실적');
  });

  it('marks unknown company exposure as unverified, rather than applying a technology-company template', () => {
    const [unknown] = stockGuideConnections('rates', [stock('UNKNOWN')]);
    expect(unknown.level).toBe('unverified');
    expect(unknown.evidence).toBeUndefined();
    expect(unknown.condition).toContain('확인하지 못했어요');
    const [etf] = stockGuideConnections('earnings', [stock('SPY')]);
    expect(etf.evidence).toBeUndefined();
    expect(etf.watch).toContain('ETF');
  });

  it('uses only the matching company for an earnings release and excludes samples', () => {
    const earnings = event('earnings', -hour, { kind: 'earnings', symbol: 'AAPL', result });
    const connected = stockGuideConnections('earnings', [stock('aapl'), stock('MSFT'), stock('NVDA', { demo: true })], earnings);
    expect(connected.map(item => item.stock.symbol)).toEqual(['AAPL']);
    expect(stockGuideConnections('earnings', [stock('AAPL', { demo: true })], earnings)).toEqual([]);
  });

  it('keeps company currency exposure separate from account translation and respects KRW stock identity', () => {
    const connections = stockGuideConnections('currency', [stock('AAPL'), stock('MSFT'), stock('005930.KS', { currency: 'USD' })]);
    expect(connections.map(item => item.level)).toEqual(['company', 'currency']);
    expect(connections[0].condition).toContain('계좌의 원화 환산 효과');
    expect(connections[1].path).toContain('원화 평가액');
  });

  it('does not mistake CPI for Samsung memory prices or duplicate broker holdings', () => {
    const connections = stockGuideConnections('inflation', [stock('005930'), stock('005930.KS', { broker: 'toss' })]);
    expect(connections).toHaveLength(1);
    expect(connections[0].name).toBe('삼성전자');
    expect(connections[0].condition).toContain('메모리 가격 지표가 아니에요');
  });
});

describe('actual report and next-confirmation selection', () => {
  it('only uses released recent results, prioritizes a real user holding and never invents a visit baseline', () => {
    const macro = event('macro', -hour, { result });
    const mine = event('mine', -2 * hour, { kind: 'earnings', symbol: 'AAPL', result });
    const source = [macro, mine, event('other', -hour, { kind: 'earnings', symbol: 'MSFT', result }),
      event('pending', -hour), event('future-result', hour, { result }), event('expired', -8 * 24 * hour, { result }),
      event('invalid', 0, { at: 'invalid', result })];
    expect(recentPersonalResults(source, [stock('AAPL')], now)).toEqual([mine, macro]);
    expect(recentPersonalResults(source, [], 0)).toEqual([]);
    expect(source[0]).toBe(macro);
  });

  it('continues with the same series or same company instead of the next unrelated release', () => {
    const cpi = event('cpi-next', 2 * hour);
    const pce = event('pce-sooner', hour, { kind: 'pce' });
    expect(nextRelatedEvent({ kind: 'cpi' }, [pce, cpi], now)).toBe(cpi);
    const mine = event('my-next', 3 * hour, { kind: 'earnings', symbol: 'AAPL' });
    const other = event('other-next', hour, { kind: 'earnings', symbol: 'MSFT' });
    expect(nextRelatedEvent({ kind: 'earnings', symbol: 'aapl' }, [other, mine], now)).toBe(mine);
    expect(nextRelatedEvent({ kind: 'earnings', symbol: 'TSLA' }, [other, mine], now)).toBeUndefined();
  });
});
