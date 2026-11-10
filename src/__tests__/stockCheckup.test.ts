import { describe, expect, it } from 'vitest';
import type { CandleRaw } from '@/config/constants';
import { buildStockCheckup, type StockCheckItem, type StockCheckupInput } from '@/utils/stockCheckup';

const candles = (count = 21): CandleRaw => ({
  s: 'ok',
  c: Array(count).fill(100),
  h: [], l: [], o: [],
  t: Array.from({ length: count }, (_, index) => 1_700_000_000 + index * 86400),
  v: Array(count).fill(100),
});
const item = (id: StockCheckItem['id'], input: Partial<StockCheckupInput> = {}) =>
  buildStockCheckup({ currency: 'USD', ...input }).items.find(result => result.id === id)!;

describe('buildStockCheckup', () => {
  it('keeps missing data unavailable instead of inventing scores or neutral observations', () => {
    const result = buildStockCheckup({ currency: 'USD' });
    expect(result.items).toHaveLength(2);
    expect(result.items.every(value => !value.available)).toBe(true);
    expect(result.summary).toBe('아직 자료가 충분하지 않아요.');
    expect(result.items.every(value => value.value === '자료 확인 전')).toBe(true);
  });

  it('compares current price with the most recent 20 closes, excluding older history', () => {
    const raw = candles();
    raw.c[0] = 10000;
    const result = item('price', { candles: raw, price: 110 });
    expect(result.available).toBe(true);
    expect(result.value).toBe('평균 대비 +10.0%');
    expect(result.meaning).toContain('20거래일 종가 평균 $100.00');
  });

  it('renders native KRW prices and falling differences correctly', () => {
    const result = item('price', { candles: candles(), price: 90, currency: 'KRW' });
    expect(result.value).toBe('평균 대비 −10.0%');
    expect(result.meaning).toContain('₩100');
    expect(result.meaning).not.toContain('$');
  });

  it('does not show negative zero for tiny price differences', () => {
    expect(item('price', { candles: candles(), price: 99.999 }).value).toBe('평균과 비슷한 수준');
  });

  it.each([undefined, 0, -100, NaN, Infinity])('rejects invalid current price %s', price => {
    expect(item('price', { candles: candles(), price }).available).toBe(false);
  });

  it('requires 20 price observations and 21 volume observations', () => {
    expect(item('price', { candles: candles(19), price: 100 }).available).toBe(false);
    expect(item('price', { candles: candles(20), price: 100 }).available).toBe(true);
    expect(item('volume', { candles: candles(20) }).available).toBe(false);
  });

  it.each([0, NaN, Infinity, -1, null])('rejects invalid latest prices in history: %s', bad => {
    const raw = candles();
    raw.c[20] = bad as number;
    expect(item('price', { candles: raw, price: 100 }).available).toBe(false);
  });

  it('compares latest volume with the previous 20 days, not an average including itself', () => {
    const raw = candles();
    raw.v[20] = 200;
    const result = item('volume', { candles: raw });
    expect(result.available).toBe(true);
    expect(result.value).toBe('평소의 2.0배');
    expect(result.meaning).toContain('직전 20거래일');
    expect(result.meaning).toContain('장중');
  });

  it('does not round a small positive volume ratio to zero', () => {
    const raw = candles();
    raw.v[20] = 1;
    expect(item('volume', { candles: raw }).value).toBe('평소의 0.1배 미만');
  });

  it.each([0, NaN, Infinity, -1, null])('does not classify invalid latest volume %s as average activity', bad => {
    const raw = candles();
    raw.v[20] = bad as number;
    const result = item('volume', { candles: raw });
    expect(result.available).toBe(false);
    expect(result.value).toBe('자료 부족');
  });

  it('does not silently skip a missing observation in the comparison period', () => {
    const raw = candles();
    raw.v[3] = 0;
    expect(item('volume', { candles: raw }).available).toBe(false);
  });

  it.each(['reversed', 'duplicate', 'missing', 'invalid', 'same-day'] as const)('rejects %s dates rather than pairing unrelated history', problem => {
    const raw = candles();
    if (problem === 'reversed') raw.t.reverse();
    if (problem === 'duplicate') raw.t[20] = raw.t[19];
    if (problem === 'missing') raw.t.pop();
    if (problem === 'invalid') raw.t[20] = NaN;
    if (problem === 'same-day') raw.t[20] = raw.t[19] + 60;
    expect(item('volume', { candles: raw }).available).toBe(false);
    expect(item('price', { candles: raw, price: 100 }).available).toBe(false);
  });

  it('does not leak stale observations when the provider reports no data', () => {
    const raw = candles();
    raw.s = 'no_data';
    expect(item('price', { candles: raw, price: 100 }).available).toBe(false);
    expect(item('volume', { candles: raw }).available).toBe(false);
  });

  it('only explains price and volume, with no empty financial placeholders', () => {
    const result = buildStockCheckup({ currency: 'USD', price: 100, candles: candles() });
    expect(result.items.map(value => value.id)).toEqual(['price', 'volume']);
    expect(result.summary).toBe('가격과 거래량의 변화를 함께 살펴봐요.');
  });
});
