import { describe, expect, it } from 'vitest';
import { buildComposition, layoutComposition } from '@/utils/portfolioComposition';

const stock = (symbol: string, shares: number, avgCost = 10) => ({ symbol, shares, avgCost, targetReturn: 10 });
describe('portfolio composition', () => {
  it('merges lots and computes return from their summed cost, not an average of returns', () => {
    const result = buildComposition([stock('AAPL', 1, 10), stock('AAPL', 3, 20)], { AAPL: { c: 25, dp: 2 } }, 1400, 'USD');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].value).toBe(100);
    expect(result.items[0].weight).toBe(100);
    expect(result.items[0].pnl).toBeCloseTo(30 / 70 * 100);
  });
  it('excludes missing quotes and preserves exact small weights', () => {
    const result = buildComposition([stock('AAPL', 999), stock('MSFT', 1), stock('TSLA', 5)], { AAPL: { c: 10 }, MSFT: { c: 10 } }, 1400, 'USD');
    expect(result.missing).toBe(1);
    expect(result.items[1].weight).toBeCloseTo(0.1);
    expect(result.items[1].today).toBeNull();
  });
  it('does not manufacture zero return when any lot has no cost', () => {
    const result = buildComposition([stock('AAPL', 1, 0), stock('AAPL', 1, 20)], { AAPL: { c: 10, dp: 0 } }, 1400, 'KRW');
    expect(result.items[0].pnl).toBeNull();
    expect(result.items[0].today).toBe(0);
  });
  it('normalizes KRW and USD holdings before calculating proportions', () => {
    const result = buildComposition([stock('005930.KS', 1, 70000), stock('AAPL', 1, 40)], { '005930.KS': { c: 70000 }, AAPL: { c: 50 } }, 1400, 'KRW');
    expect(result.total).toBe(140000);
    expect(result.items.map(item => item.weight)).toEqual([50, 50]);
  });
});

it('map areas preserve the actual portfolio weight, including tiny holdings', () => {
  const tiles = layoutComposition([{ weight: 87.5 }, { weight: 12.4 }, { weight: 0.1 }]);
  for (const tile of tiles) {
    expect(tile.w * tile.h / 100).toBeCloseTo(tile.weight);
    expect(tile.x + tile.w).toBeLessThanOrEqual(100.00001);
    expect(tile.y + tile.h).toBeLessThanOrEqual(100.00001);
  }
  expect(layoutComposition([])).toEqual([]);
});

it('uses the available aspect ratio without changing weights or overlapping tiles', () => {
  const holdings = [52, 20, 12, 8, 7.9, 0.1].map(weight => ({ weight }));
  for (const aspect of [0.75, 1, 1.6, 3, Number.NaN, 0]) {
    const tiles = layoutComposition(holdings, aspect);
    for (const [index, tile] of tiles.entries()) {
      expect(tile.w * tile.h / 100).toBeCloseTo(tile.weight);
      for (const other of tiles.slice(index + 1)) {
        const overlapWidth = Math.min(tile.x + tile.w, other.x + other.w) - Math.max(tile.x, other.x);
        const overlapHeight = Math.min(tile.y + tile.h, other.y + other.h) - Math.max(tile.y, other.y);
        expect(Math.min(overlapWidth, overlapHeight)).toBeLessThanOrEqual(0.00001);
      }
    }
  }
  expect(layoutComposition(holdings, 0.75)[0].w).toBe(100);
  expect(layoutComposition(holdings, 1.6)[0].h).toBe(100);
});
