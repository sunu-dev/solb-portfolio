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
    expect(result.items).toHaveLength(3);
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

  it('shows positive PER with an explanation, without inferring undervaluation', () => {
    const result = item('earnings', { fundamentals: { per: 15, eps: 2, currency: 'USD' } });
    expect(result.available).toBe(true);
    expect(result.value).toBe('PER 15.0배');
    expect(result.meaning).toContain('주당순이익은 $2.00');
    expect(result.meaning).toContain('저평가라고 단정할 수는 없어요');
  });

  it('shows a reported loss instead of a contradictory positive PER', () => {
    const result = item('earnings', { fundamentals: { per: 10, eps: -2 } });
    expect(result.available).toBe(true);
    expect(result.value).toBe('주당순이익 -$2.00');
    expect(result.meaning).toContain('손실이 보고');
    expect(result.nextCheck).toContain('기준이 다를 수');
  });

  it('preserves zero EPS as reported data', () => {
    const result = item('earnings', { fundamentals: { eps: 0 } });
    expect(result.available).toBe(true);
    expect(result.value).toBe('주당순이익 $0.00');
    expect(result.meaning).toContain('주당순이익은 0');
  });

  it('can explain actual EPS when PER is unavailable without calculating a replacement', () => {
    const result = item('earnings', { price: 300, fundamentals: { eps: 2, per: null } });
    expect(result.value).toBe('주당순이익 $2.00');
    expect(result.meaning).toContain('이전 실적과 비교');
  });

  it.each([0, -10, NaN, Infinity, null])('does not present invalid PER %s as a company valuation', per => {
    expect(item('earnings', { fundamentals: { per } }).available).toBe(false);
  });

  it('keeps missing EPS distinct from reported zero', () => {
    expect(item('earnings', { fundamentals: { eps: null } }).available).toBe(false);
    expect(item('earnings', { fundamentals: { eps: NaN } }).available).toBe(false);
  });

  it('does not mix fundamentals reported for a different currency with the selected stock', () => {
    const result = buildStockCheckup({ currency: 'KRW', fundamentals: { currency: 'USD', eps: 2, per: 15, dividendYield: 3 } });
    expect(result.items.find(value => value.id === 'earnings')?.available).toBe(false);
    expect(result.items.find(value => value.id === 'dividend')).toBeUndefined();
  });

  it('adds dividend information only for an actual nonnegative finite value', () => {
    expect(item('dividend', { fundamentals: { dividendYield: 2.5 } }).value).toBe('배당수익률 2.50%');
    expect(item('dividend', { fundamentals: { dividendYield: 0 } }).value).toBe('배당수익률 0.00%');
    for (const dividendYield of [null, undefined, -1, NaN, Infinity]) {
      expect(item('dividend', { fundamentals: { dividendYield } })).toBeUndefined();
    }
  });

  it('does not infer company quality or growth from price and volume alone', () => {
    const result = buildStockCheckup({ currency: 'USD', price: 100, candles: candles() });
    expect(result.items.filter(value => value.available).map(value => value.id)).toEqual(['price', 'volume']);
    expect(result.items.find(value => value.id === 'earnings')?.available).toBe(false);
    expect(result.summary).toBe('확인된 정보부터 차근차근 살펴봐요.');
  });
});
