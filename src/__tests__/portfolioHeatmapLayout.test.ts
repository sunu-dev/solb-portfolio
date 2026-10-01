import { describe, expect, it } from 'vitest';
import { layoutPortfolioHeatmap, type HeatmapRect } from '@/utils/portfolioHeatmapLayout';

const holdings = [
  { symbol: 'NVDA', label: '엔비디아', weight: 35, sector: '기술', industry: '반도체', retained: 1 },
  { symbol: 'AMD', label: 'AMD', weight: 15, sector: '기술', industry: '반도체', retained: 2 },
  { symbol: 'MSFT', label: '마이크로소프트', weight: 10, sector: '기술', industry: '소프트웨어', retained: 3 },
  { symbol: 'JPM', label: 'JP모건', weight: 25, sector: '금융', industry: '은행', retained: 4 },
  { symbol: 'BAC', label: '뱅크오브아메리카', weight: 10, sector: '금융', industry: '은행', retained: 5 },
  { symbol: 'XOM', label: '엑손모빌', weight: 5, sector: '에너지', industry: '석유', retained: 6 },
];

function checkPartition(rectangles: HeatmapRect[], parent: HeatmapRect) {
  expect(rectangles.reduce((sum, rect) => sum + rect.w * rect.h, 0)).toBeCloseTo(parent.w * parent.h, 6);
  for (const [index, rect] of rectangles.entries()) {
    expect([rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)).toBe(true);
    expect(rect.w).toBeGreaterThanOrEqual(0); expect(rect.h).toBeGreaterThanOrEqual(0);
    expect(rect.x).toBeGreaterThanOrEqual(parent.x - 1e-8);
    expect(rect.y).toBeGreaterThanOrEqual(parent.y - 1e-8);
    expect(rect.x + rect.w).toBeLessThanOrEqual(parent.x + parent.w + 1e-8);
    expect(rect.y + rect.h).toBeLessThanOrEqual(parent.y + parent.h + 1e-8);
    for (const other of rectangles.slice(index + 1)) {
      const overlapWidth = Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x);
      const overlapHeight = Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y);
      expect(overlapWidth > 1e-8 && overlapHeight > 1e-8).toBe(false);
    }
  }
}

describe('hierarchical portfolio heatmap', () => {
  it.each([[272, 290], [350, 320], [768, 420], [1280, 520]])('conserves areas and hierarchy at %s × %s', (width, height) => {
    const { sectors } = layoutPortfolioHeatmap(holdings, width, height);
    checkPartition(sectors, { x: 0, y: 0, w: width, h: height });
    const returned = [];
    for (const sector of sectors) {
      const sectorWeight = holdings.filter(item => item.sector === sector.label).reduce((sum, item) => sum + item.weight, 0);
      expect(sector.w * sector.h / (width * height)).toBeCloseTo(sectorWeight / 100, 12);
      expect([0, 16]).toContain(sector.headerHeight);
      const content = { ...sector, y: sector.y + sector.headerHeight, h: sector.h - sector.headerHeight };
      checkPartition(sector.industries, content);
      for (const industry of sector.industries) {
        expect([0, 12]).toContain(industry.headerHeight);
        const industryContent = { ...industry, y: industry.y + industry.headerHeight, h: industry.h - industry.headerHeight };
        checkPartition(industry.cells, industryContent);
        const industryWeight = industry.cells.reduce((sum, cell) => sum + cell.weight, 0);
        expect(industry.w * industry.h / (content.w * content.h)).toBeCloseTo(industryWeight / sectorWeight, 12);
        for (const cell of industry.cells) {
          expect(cell.w * cell.h / (industryContent.w * industryContent.h)).toBeCloseTo(cell.weight / industryWeight, 12);
          expect(cell.sector).toBe(sector.label);
          expect(cell.industry).toBe(industry.label);
          expect(cell.retained).toBe(holdings.find(item => item.symbol === cell.symbol)!.retained);
          returned.push(cell.symbol);
        }
      }
    }
    expect(returned.sort()).toEqual(holdings.map(item => item.symbol).sort());
  });

  it('is deterministic across input order, including tied weights, and preserves input', () => {
    const items = holdings.map(item => ({ ...item, weight: 10 }));
    const original = structuredClone(items);
    expect(layoutPortfolioHeatmap(items, 350, 320)).toEqual(layoutPortfolioHeatmap([...items].reverse(), 350, 320));
    expect(items).toEqual(original);
  });

  it('retains tiny groups and all data cells while omitting headers that do not fit', () => {
    const items = [
      { ...holdings[0], weight: 99.999 },
      { ...holdings[3], weight: .001 },
    ];
    const { sectors } = layoutPortfolioHeatmap(items, 350, 320);
    expect(sectors).toHaveLength(2);
    expect(sectors[1].headerHeight).toBe(0);
    expect(sectors[1].industries[0].headerHeight).toBe(0);
    expect(sectors[1].industries[0].cells).toHaveLength(1);
    expect(sectors[1].w * sectors[1].h / (350 * 320)).toBeCloseTo(.001 / 100, 12);
    const tiny = layoutPortfolioHeatmap([holdings[0]], 12, 10).sectors[0];
    expect(tiny.headerHeight).toBe(0);
    expect(tiny.industries[0].headerHeight).toBe(0);
    expect(tiny.industries[0].cells[0]).toMatchObject({ x: 0, y: 0, w: 12, h: 10 });
  });

  it('supports a single holding and excludes invalid dimensions and weights', () => {
    const sector = layoutPortfolioHeatmap([holdings[0]], 350, 320).sectors[0];
    expect(sector).toMatchObject({ x: 0, y: 0, w: 350, h: 320, headerHeight: 16 });
    expect(sector.industries[0].cells[0]).toMatchObject({ x: 0, y: 28, w: 350, h: 292 });
    expect(layoutPortfolioHeatmap([], 350, 320).sectors).toEqual([]);
    expect(layoutPortfolioHeatmap(holdings, 0, 320).sectors).toEqual([]);
    expect(layoutPortfolioHeatmap(holdings, 350, Infinity).sectors).toEqual([]);
    expect(layoutPortfolioHeatmap(holdings.map((item, index) => ({ ...item, weight: [0, -1, NaN, Infinity][index % 4] })), 350, 320).sectors).toEqual([]);
  });

  it('normalizes very large finite weights and omits unknown industry headers', () => {
    const items = [holdings[0], holdings[1]].map(item => ({ ...item, weight: 1e308, sector: '', industry: ' ' }));
    const sector = layoutPortfolioHeatmap(items, 350, 320).sectors[0];
    expect(sector.label).toBe('기타');
    expect(sector.industries[0].label).toBe('');
    expect(sector.industries[0].headerHeight).toBe(0);
    expect(sector.industries[0].cells[0].y).toBe(16);
    const cells = sector.industries[0].cells;
    expect(cells[0].w * cells[0].h).toBeCloseTo(cells[1].w * cells[1].h, 10);
  });
});
