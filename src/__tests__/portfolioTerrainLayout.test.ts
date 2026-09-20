import { describe, expect, it } from 'vitest';
import { layoutPortfolioTerrain, type TerrainPoint } from '@/utils/portfolioTerrainLayout';

function signedEdgeDistance(a: TerrainPoint, b: TerrainPoint, point: TerrainPoint): number {
  return ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
}

describe('portfolio terrain layout', () => {
  it.each([[320, 320], [390, 390], [768, 420], [1280, 520]])('conserves the ellipse and actual weight areas at %s × %s', (width, height) => {
    const whole = layoutPortfolioTerrain([{ symbol: 'ALL', weight: 1 }], width, height)[0];
    for (const weights of [[87.5, 12.4, .1], [37, 20, 14, 10, 8, 6, 3, 2], Array.from({ length: 50 }, (_, i) => 50 - i), [99.999999, .000001]]) {
      const items = weights.map((weight, index) => ({ symbol: `S${index}`, weight, label: `종목 ${index}`, preserved: index }));
      const territories = layoutPortfolioTerrain(items, width, height);
      expect(territories).toHaveLength(weights.length);
      const totalArea = territories.reduce((sum, territory) => sum + territory.area, 0);
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      expect(totalArea / whole.area).toBeCloseTo(1, 10);
      for (const territory of territories) {
        expect(territory.area / totalArea).toBeCloseTo(territory.weight / totalWeight, 10);
        expect(territory.preserved).toBe(Number(territory.symbol.slice(1)));
        expect(territory.label).toBe(`종목 ${territory.preserved}`);
        expect(territory.area).toBeGreaterThan(0);
        expect(territory.radius).toBeGreaterThan(0);
        expect(territory.labelAnchor.radius).toBeGreaterThanOrEqual(territory.radius);
        expect(territory.path).toMatch(/^M.+Z$/);
        expect(territory.path).not.toMatch(/NaN|Infinity/);
        expect(territory.x).toBe(territory.centroid.x);
        expect(territory.y).toBe(territory.centroid.y);
        expect(territory.bounds.width).toBeGreaterThan(0);
        expect(territory.bounds.height).toBeGreaterThan(0);
        for (const [index, point] of territory.points.entries()) {
          expect(Number.isFinite(point.x + point.y)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(width);
          expect(point.y).toBeLessThanOrEqual(height);
          const next = territory.points[(index + 1) % territory.points.length];
          if (point.x === next.x && point.y === next.y) continue;
          // Each convex territory encloses its centroid and the complete label disc.
          expect(signedEdgeDistance(point, next, territory.centroid)).toBeGreaterThanOrEqual(territory.radius - 1e-7);
          expect(signedEdgeDistance(point, next, territory.labelAnchor)).toBeGreaterThanOrEqual(territory.labelAnchor.radius - 1e-7);
        }
      }
    }
  });

  it('has no overlapping interiors between territories', () => {
    const territories = layoutPortfolioTerrain([37, 20, 14, 10, 8, 6, 3, 2].map((weight, index) => ({ symbol: `S${index}`, weight })), 768, 420);
    const hasSeparatingEdge = (a: TerrainPoint[], b: TerrainPoint[]) => a.some((point, index) => {
      const next = a[(index + 1) % a.length];
      return b.every(other => signedEdgeDistance(point, next, other) <= 1e-7);
    });
    for (const [index, territory] of territories.entries()) {
      for (const other of territories.slice(index + 1)) {
        expect(hasSeparatingEdge(territory.points, other.points) || hasSeparatingEdge(other.points, territory.points)).toBe(true);
      }
    }
  });

  it('is deterministic, independent of item order, and does not mutate input', () => {
    const items = [{ symbol: 'B', weight: 20 }, { symbol: 'A', weight: 20 }, { symbol: 'C', weight: 60 }];
    const original = structuredClone(items);
    const first = layoutPortfolioTerrain(items, 390, 390);
    expect(layoutPortfolioTerrain(items, 390, 390)).toEqual(first);
    expect(layoutPortfolioTerrain([...items].reverse(), 390, 390)).toEqual(first);
    expect(items).toEqual(original);
  });

  it('keeps tiny holdings tiny and handles large finite weights without overflow', () => {
    const territories = layoutPortfolioTerrain([{ symbol: 'A', weight: 999 }, { symbol: 'B', weight: 1 }], 390, 390);
    expect(territories[1].area / territories[0].area).toBeCloseTo(1 / 999, 12);
    const large = layoutPortfolioTerrain([{ symbol: 'A', weight: 1e308 }, { symbol: 'B', weight: 1e308 }], 390, 390);
    expect(large[0].area / large[1].area).toBeCloseTo(1, 10);
  });

  it('excludes invalid weights and dimensions, and centers a single territory', () => {
    expect(layoutPortfolioTerrain([], 390, 390)).toEqual([]);
    for (const [width, height] of [[0, 390], [390, -1], [NaN, 390], [390, Infinity]]) {
      expect(layoutPortfolioTerrain([{ symbol: 'A', weight: 1 }], width, height)).toEqual([]);
    }
    const one = layoutPortfolioTerrain([{ symbol: 'A', weight: 1 }, { symbol: 'B', weight: 0 }, { symbol: 'C', weight: -1 }, { symbol: 'D', weight: NaN }, { symbol: 'E', weight: Infinity }], 390, 390);
    expect(one).toHaveLength(1);
    expect(one[0].x).toBeCloseTo(195, 10);
    expect(one[0].y).toBeCloseTo(195, 10);
    expect(one[0].points).toHaveLength(128);
  });
});
