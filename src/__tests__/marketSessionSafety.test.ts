import { describe, expect, it } from 'vitest';
import { getMarketStatus } from '@/utils/marketHours';
import { getMarketStatus as dual } from '@/utils/marketStatus';
import { isTodayHoliday } from '@/config/marketHolidays';

describe('market session boundaries', () => {
  it('keeps Friday US regular trading open on Saturday in Korea', () => {
    expect(getMarketStatus(new Date('2026-09-12T01:00:00+09:00')).phase).toBe('open');
    expect(dual(new Date('2026-09-12T01:00:00+09:00')).us.status).toBe('open');
  });
  it('does not invent a Monday Korean dawn US session', () => {
    expect(getMarketStatus(new Date('2026-09-14T01:00:00+09:00')).phase).toBe('weekend');
  });
  it('skips Labor Day for the next opening', () => {
    expect(getMarketStatus(new Date('2026-09-07T15:00:00Z'))).toEqual({
      phase: 'holiday', nextOpensInMs: 22.5 * 3600000,
    });
  });
  it.each(['2026-11-27', '2026-12-24'])('handles early close on %s', date => {
    expect(getMarketStatus(new Date(`${date}T17:30:00Z`))).toEqual({ phase: 'open', closesInMs: 1800000 });
    expect(getMarketStatus(new Date(`${date}T18:00:00Z`)).phase).toBe('post');
  });
  it('uses the target date DST offset across the spring transition', () => {
    expect(getMarketStatus(new Date('2026-03-06T21:00:00Z'))).toEqual({
      phase: 'post', nextOpensInMs: 64.5 * 3600000,
    });
  });
  it('does not guess holidays outside the published calendar', () => {
    expect(getMarketStatus(new Date('2027-01-01T15:00:00Z')).phase).toBe('unknown');
  });
  it('keeps KRX closing auction within the regular session', () => {
    expect(dual(new Date('2026-09-10T15:25:00+09:00')).kr.status).toBe('open');
    expect(dual(new Date('2026-09-10T15:30:00+09:00')).kr.status).toBe('closed');
  });
  it('checks holiday dates in each exchange timezone', () => {
    const now = new Date('2026-09-08T01:00:00+09:00');
    expect(isTodayHoliday('US', now)?.label).toBe('Labor Day');
    expect(isTodayHoliday('KR', now)).toBeNull();
  });
});
