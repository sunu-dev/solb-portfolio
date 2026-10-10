import { describe, expect, it } from 'vitest';
import { latestIntradaySession, tradingDate } from '@/lib/intradayCandles';
const ts = (value: string) => Date.parse(value) / 1000;
const now = Date.parse('2026-10-10T12:00:00Z');
const fixture = (times: number[], timeZone = 'America/New_York') => ({ meta: { exchangeTimezoneName: timeZone }, timestamp: times,
  indicators: { quote: [{ open: times.map(() => 100), high: times.map(() => 103), low: times.map(() => 99), close: times.map(() => 102), volume: times.map(() => 10) }] } });
describe('latest intraday trading session', () => {
  it('shows Friday on a weekend and never combines multiple trading days', () => {
    const t = ['2026-10-08T19:55:00Z', '2026-10-09T13:30:00Z', '2026-10-09T19:55:00Z'].map(ts);
    const result = latestIntradaySession(fixture(t), now)!;
    expect(result.sessionDate).toBe('2026-10-09');
    expect(result.t).toEqual(t.slice(1));
    expect(result.asOf).toBe(t[2]);
  });
  it('uses exchange dates, including US sessions that extend past midnight in Korea', () => {
    expect(tradingDate(ts('2026-10-09T19:55:00Z'), 'America/New_York')).toBe('2026-10-09');
    expect(tradingDate(ts('2026-10-09T19:55:00Z'), 'Asia/Seoul')).toBe('2026-10-10');
    const result = latestIntradaySession(fixture([ts('2026-10-08T00:00:00Z'), ts('2026-10-09T00:00:00Z')], 'Asia/Seoul'), now)!;
    expect(result.sessionDate).toBe('2026-10-09');
    expect(result.t).toHaveLength(1);
  });
  it('sorts and deduplicates timestamps to keep the chart valid', () => {
    const a = ts('2026-10-09T13:30:00Z'), b = a + 300;
    expect(latestIntradaySession(fixture([b, a, a]), now)?.t).toEqual([a, b]);
  });
  it('drops invalid and future candles without inventing missing prices', () => {
    const a = ts('2026-10-09T13:30:00Z');
    const input = fixture([a, a + 300, now / 1000 + 3600]);
    input.indicators.quote[0].high[1] = NaN;
    const result = latestIntradaySession(input, now)!;
    expect(result.t).toEqual([a]);
    expect(result.c).toEqual([102]);
  });
  it('does not guess an exchange timezone or fabricate a session', () => {
    expect(latestIntradaySession(fixture([], 'Asia/Seoul'), now)).toBeNull();
    expect(latestIntradaySession(fixture([now / 1000], 'Invalid/Zone'), now)).toBeNull();
    expect(latestIntradaySession({ timestamp: [now / 1000] }, now)).toBeNull();
  });
});
