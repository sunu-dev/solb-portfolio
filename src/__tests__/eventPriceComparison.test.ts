import { describe, expect, it } from 'vitest';
import { eventPriceComparison } from '@/utils/eventPriceComparison';

describe('event price window', () => {
  it('does not let today’s rally alter a closed event’s loss or recovery', () => {
    const result = eventPriceComparison({ c: [100, 90], t: [1641168000, 1665619200] }, false, 500);
    expect(result).toMatchObject({ basePrice: 100, currentChange: -10, maxDrop: -10, recovered: false, recoveryDays: null });
    expect(result?.maxDropDate).toBe('2022-10-13');
  });
  it('counts the trading observations until recovery after the lowest close', () => {
    expect(eventPriceComparison({ c: [100, 90, 95, 101] }, false, 500))
      .toMatchObject({ currentChange: 1, recovered: true, recoveryDays: 3 });
  });
  it('can confirm an ongoing recovery from the last quote without inventing its trading date', () => {
    expect(eventPriceComparison({ c: [100, 90] }, true, 110))
      .toMatchObject({ currentChange: 10, recovered: true, recoveryDays: null });
  });
  it('does not call a price that never fell below the basis a recovery', () => {
    expect(eventPriceComparison({ c: [100, 101, 102] }, false))
      .toMatchObject({ maxDrop: 0, recovered: false, recoveryDays: null });
  });
  it('rejects unusable history without zero-price calculations', () => {
    expect(eventPriceComparison({ c: [0, NaN, 100] }, false)).toBeNull();
  });
});
