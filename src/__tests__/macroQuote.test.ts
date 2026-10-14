import { describe, expect, it } from 'vitest';
import { buildYahooQuote } from '@/utils/yahooQuote';
import { macroEntryFromQuote, macroValue } from '@/utils/macroQuote';
import { resolveUsdKrwState } from '@/utils/koreanNumber';

describe('current FX rate and daily comparison', () => {
  const missingPrevious = {
    meta: { regularMarketPrice: 1335.03, chartPreviousClose: 1339.08 },
    indicators: { quote: [{ close: [1339.08, 1342.99, 1340.84, 1334.13, null, 1335.03] }] },
  };
  it('retains the current conversion rate without treating an older close as yesterday', () => {
    const quote = buildYahooQuote(missingPrevious, true);
    expect(quote).toMatchObject({ c: 1335.03, d: null, dp: null, pc: null });
    const entry = macroEntryFromQuote(quote);
    expect(entry).toEqual({ value: 1335.03, change: null, changePercent: null });
    expect(resolveUsdKrwState({ 'USD/KRW': entry })).toEqual({ rate: 1335.03, stale: false });
    expect(buildYahooQuote(missingPrevious)).toBeNull();
  });
  it('preserves an actual unchanged comparison and a known negative comparison', () => {
    expect(buildYahooQuote({ meta: { regularMarketPrice: 100, previousClose: 100 } }, true)).toMatchObject({ d: 0, dp: 0, pc: 100 });
    expect(buildYahooQuote({ meta: { regularMarketPrice: 99, previousClose: 100 } }, true)).toMatchObject({ d: -1, dp: -1, pc: 100 });
  });
  it.each([0, -1, NaN, Infinity])('rejects an invalid current price or cached rate: %s', value => {
    expect(buildYahooQuote({ meta: { regularMarketPrice: value } }, true)).toBeNull();
    expect(macroEntryFromQuote({ c: value })).toBeNull();
    expect(resolveUsdKrwState({ 'USD/KRW': { value } }).stale).toBe(true);
  });
});

describe('legacy event macro labels', () => {
  it('connects live canonical keys to event labels, preferring current values over legacy placeholders', () => {
    const data = { '코스피': { value: 6008.81 }, KOSPI: { value: null }, WTI: { value: 94.56 }, 'WTI Oil': { value: 60 } };
    expect(macroValue(data, 'KOSPI')).toBe(6008.81);
    expect(macroValue(data, 'WTI Oil')).toBe(94.56);
    expect(macroValue({ KOSPI: { value: 6000 } }, 'KOSPI')).toBe(6000);
    expect(macroValue({ 'USD/KRW': { value: Infinity } }, 'USD/KRW')).toBeNull();
    expect(macroValue({}, 'VIX')).toBeNull();
  });
});
