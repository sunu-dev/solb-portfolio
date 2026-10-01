import { describe, expect, it } from 'vitest';
import { portfolioTerrainContours } from '@/utils/portfolioTerrainContours';

const cells = [
  { weight: 87.5, labelAnchor: { x: 147, y: 187, radius: 136 } },
  { weight: 12.4, labelAnchor: { x: 299, y: 119, radius: 30 } },
  { weight: .1, labelAnchor: { x: 324, y: 240, radius: 4 } },
];

/** Extract the shared starting point and the endpoints of every cubic segment. */
function samples(path: string): { x: number; y: number }[] {
  const [start, ...curves] = path.slice(1, -1).split('C');
  return [start, ...curves.map(curve => curve.split(' ')[2])].map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
});
}

function inside(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

describe('portfolio terrain contours', () => {
  it.each([[320, 320], [390, 350], [768, 420], [1280, 520]])('produces finite, continuous nested closed contours at %s × %s', (width, height) => {
    const paths = portfolioTerrainContours(cells, width, height);
    expect(paths).toHaveLength(11);
    for (const path of paths) {
      expect(path).toMatch(/^M/);
      expect(path).not.toMatch(/NaN|Infinity/);
      expect(path).toMatch(/Z$/);
      expect(path.match(/M/g)).toHaveLength(1);
      expect(path.match(/C/g)).toHaveLength(32);
      const points = samples(path);
      expect(points[0]).toEqual(points.at(-1));
    }
    // Each ring contains the complete preceding ring. Curves change their broad
    // shape gradually while retaining one continuous field and no fragments.
    for (let index = 1; index < paths.length; index++) {
      const previous = samples(paths[index - 1]);
      const current = samples(paths[index]);
      for (const point of previous) expect(inside(point, current)).toBe(true);
    }
    const outer = samples(paths.at(-1)!);
    expect(outer.some(point => point.x < 0 || point.x > width || point.y < 0 || point.y > height)).toBe(true);
  });

  it('is deterministic, preserves inputs, and responds to the real anchor positions', () => {
    const original = structuredClone(cells);
    const first = portfolioTerrainContours(cells, 350, 350);
    expect(portfolioTerrainContours(cells, 350, 350)).toEqual(first);
    expect(cells).toEqual(original);
    expect(portfolioTerrainContours(cells.map(cell => ({ ...cell, labelAnchor: { ...cell.labelAnchor, x: cell.labelAnchor.x - 60 } })), 350, 350)).not.toEqual(first);
    expect(portfolioTerrainContours(cells.map(cell => ({ ...cell, weight: cell.weight * 1000 })), 350, 350)).toEqual(first);
  });

  it('filters invalid inputs and handles one or many anchors without contour fragments', () => {
    expect(portfolioTerrainContours(cells, 0, 350)).toEqual([]);
    expect(portfolioTerrainContours(cells, 350, Infinity)).toEqual([]);
    expect(portfolioTerrainContours([], 350, 350)).toEqual([]);
    expect(portfolioTerrainContours([{ weight: 1, labelAnchor: { x: NaN, y: 1, radius: 2 } }], 350, 350)).toEqual([]);
    expect(portfolioTerrainContours([{ ...cells[0], weight: -1 }], 350, 350)).toEqual([]);
    expect(portfolioTerrainContours([cells[0]], 350, 350)).toHaveLength(11);
    const many = Array.from({ length: 50 }, (_, index) => ({ weight: 50 - index, labelAnchor: { x: index * 6, y: 100 + index * 3, radius: 10 } }));
    expect(portfolioTerrainContours(many, 350, 350)).toHaveLength(11);
    expect(portfolioTerrainContours([{ ...cells[0], weight: 1e308 }, { ...cells[1], weight: 1e308 }], 350, 350).join('')).not.toMatch(/NaN|Infinity/);
  });
});
