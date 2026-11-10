import { describe, expect, it } from 'vitest';
import { getArrivalMessage } from '@/utils/arrivalMessage';

describe('arrival message follows both exchange calendars', () => {
  it('offers rest on Sunday in Korea and Saturday in New York', () => {
    expect(getArrivalMessage(new Date('2026-10-18T03:00:00Z')).restful).toBe(true);
  });
  it.each(['2026-10-16T17:00:00Z', '2026-01-16T18:00:00Z'])(
    'does not call Korean Saturday a day off while US trading continues: %s', date => {
      const message = getArrivalMessage(new Date(date));
      expect(message.restful).toBe(false);
      expect(message.context).toBe('미국 증시 정규장 거래 중');
    },
  );
  it('does not call a Korean-only holiday a shared day off', () => {
    expect(getArrivalMessage(new Date('2026-10-09T03:00:00Z')).restful).toBe(false);
  });
  it('recognizes a shared weekday holiday once both local dates are Christmas', () => {
    expect(getArrivalMessage(new Date('2026-12-25T15:00:00Z')).restful).toBe(true);
  });
  it('returns to preparation on Korean Monday even when New York is Sunday', () => {
    const message = getArrivalMessage(new Date('2026-10-18T23:00:00Z'));
    expect(message.restful).toBe(false);
    expect(message.context).toBe('한국 증시 개장 전');
  });
  it('distinguishes a weekday close from a day off', () => {
    expect(getArrivalMessage(new Date('2026-10-13T07:00:00Z')).restful).toBe(false);
  });
  it('uses a neutral message before hydration and outside the verified calendar', () => {
    expect(getArrivalMessage(new Date('2027-01-03T03:00:00Z'))).toEqual(getArrivalMessage());
    expect(getArrivalMessage(new Date('invalid'))).toEqual(getArrivalMessage());
  });
});
