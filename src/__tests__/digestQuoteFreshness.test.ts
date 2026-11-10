import { describe, expect, it } from 'vitest';
import { buildBrief, buildPushPayload, digestPriceQuote } from '@/lib/digestBrief';

const now = Date.parse('2026-10-22T22:00:00Z');
const quote = { c: 100, d: 5, dp: 5.26, t: now / 1000 - 3600 };
describe('digest quote provenance', () => {
  it('accepts a recent quote and rejects absent, stale, or future timestamps', () => {
    expect(digestPriceQuote(quote, now)).toEqual({ c: 100, d: 5, dp: 5.26 });
    expect(digestPriceQuote({ ...quote, t: undefined }, now)).toBeNull();
    expect(digestPriceQuote({ ...quote, t: now / 1000 - 4 * 86400 }, now)).toBeNull();
    expect(digestPriceQuote({ ...quote, t: now / 1000 + 301 }, now)).toBeNull();
    expect(digestPriceQuote({ ...quote, t: NaN }, now)).toBeNull();
  });
  it('does not promote an invalid move to an email spotlight', async () => {
    const brief = await buildBrief({ investing: [{ symbol: 'MSFT', shares: 1, avgCost: 90, targetReturn: 10 }], watching: [], sold: [] }, [], 1300,
      { MSFT: { c: 100, d: 5, dp: NaN } }, 'morning');
    expect(brief).toMatchObject({ totalValue: null, biggestMover: null });
  });
  it('does not call the entire market quiet from a single quiet holding', () => {
    const payload = buildPushPayload({ totalValue: 100000, todayDelta: 0, todayPct: 0, yesterdayDelta: null, yesterdayPct: null, biggestMover: null }, 'close');
    expect(payload.body).toContain('보유 종목');
    expect(payload.body).not.toMatch(/국장 조용|시장 조용/);
  });
});
