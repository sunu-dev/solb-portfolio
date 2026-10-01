import { describe, expect, it } from 'vitest';
import { portfolioPriceHistory } from '@/utils/portfolioPriceHistory';
import type { CandleRaw } from '@/config/constants';

const candles = (c: number[], t = c.map((_, i) => 1_700_000_000 + i * 86400)): CandleRaw => ({ s: 'ok', c, t, h: [], l: [], o: [], v: [] });

describe('portfolio price history', () => {
  it('does not invent a line for missing, malformed, or single-point history', () => {
    expect(portfolioPriceHistory()).toBeNull();
    expect(portfolioPriceHistory(candles([10]))).toBeNull();
    expect(portfolioPriceHistory(candles([10, 20], [1]))).toBeNull();
    expect(portfolioPriceHistory({ ...candles([10, 20]), s: 'no_data' })).toBeNull();
  });
  it('sorts and deduplicates timestamps while excluding invalid prices', () => {
    const chart = portfolioPriceHistory(candles([20, 10, -1, 30, NaN], [200, 100, 300, 200, 400]));
    expect(chart?.count).toBe(2);
    expect(chart?.change).toBe(200);
    expect(chart?.line).toBe('M0.00,52.00 L240.00,12.00');
  });
  it('shows unchanged prices as a horizontal line and limits to the latest 30 samples', () => {
    const chart = portfolioPriceHistory(candles(Array(40).fill(10)));
    expect(chart?.count).toBe(30);
    expect(chart?.change).toBe(0);
    expect(chart?.line).not.toMatch(/NaN|Infinity/);
    expect(chart?.line.split(' ').every(point => point.endsWith(',32.00'))).toBe(true);
  });
});
