export interface HeatmapItem {
  symbol: string;
  label: string;
  weight: number;
  sector: string;
  industry: string;
}

export interface HeatmapRect { x: number; y: number; w: number; h: number }
export interface HeatmapIndustry<T extends HeatmapItem> extends HeatmapRect {
  id: string;
  label: string;
  headerHeight: number;
  cells: (T & HeatmapRect)[];
}
export interface HeatmapSector<T extends HeatmapItem> extends HeatmapRect {
  id: string;
  label: string;
  headerHeight: number;
  industries: HeatmapIndustry<T>[];
}

type Weighted<T> = { id: string; weight: number; value: T };
const compare = <T>(a: Weighted<T>, b: Weighted<T>) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Balanced binary slicing keeps every allocated rectangle proportional. */
function tile<T>(entries: Weighted<T>[], rect: HeatmapRect): { value: T; rect: HeatmapRect }[] {
  if (!entries.length) return [];
  if (entries.length === 1) return [{ value: entries[0].value, rect }];
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return entries.map(entry => ({ value: entry.value, rect: { ...rect, w: 0, h: 0 } }));
  let prefix = 0, firstWeight = 0, splitIndex = 1, nearest = Infinity;
  for (let index = 1; index < entries.length; index++) {
    prefix += entries[index - 1].weight;
    const distance = Math.abs(prefix - total / 2);
    if (distance < nearest) { nearest = distance; firstWeight = prefix; splitIndex = index; }
  }
  const ratio = firstWeight / total;
  const vertical = rect.w >= rect.h;
  const firstSize = (vertical ? rect.w : rect.h) * ratio;
  const first = vertical ? { ...rect, w: firstSize } : { ...rect, h: firstSize };
  const second = vertical
    ? { ...rect, x: rect.x + firstSize, w: rect.w - firstSize }
    : { ...rect, y: rect.y + firstSize, h: rect.h - firstSize };
  return [...tile(entries.slice(0, splitIndex), first), ...tile(entries.slice(splitIndex), second)];
}

/**
 * A sector → industry → holding heatmap in absolute canvas coordinates.
 * Sector gross area follows investment weight. Headers occupy the top of their
 * own allocation; each remaining content rectangle is split proportionally.
 * Tiny allocations retain their cells and omit unreadable headers.
 */
export function layoutPortfolioHeatmap<T extends HeatmapItem>(items: T[], width: number, height: number): { sectors: HeatmapSector<T>[] } {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return { sectors: [] };
  const valid = items.filter(item => Number.isFinite(item.weight) && item.weight > 0);
  if (!valid.length) return { sectors: [] };
  const maximumWeight = valid.reduce((maximum, item) => Math.max(maximum, item.weight), 0);
  const groups = new Map<string, Map<string, T[]>>();
  for (const item of valid) {
    const sector = item.sector.trim() || '기타';
    const industry = item.industry.trim();
    if (!groups.has(sector)) groups.set(sector, new Map());
    const industries = groups.get(sector)!;
    if (!industries.has(industry)) industries.set(industry, []);
    industries.get(industry)!.push(item);
  }
  const sectors = [...groups].map(([label, industries]) => {
    const children = [...industries].map(([industry, members]) => {
      const cells = members.map(item => ({ id: item.symbol, weight: item.weight / maximumWeight, value: item })).sort(compare);
      return {
        id: industry,
        weight: cells.reduce((sum, cell) => sum + cell.weight, 0),
        value: { label: industry, cells },
      };
    }).sort(compare);
    return { id: label, weight: children.reduce((sum, child) => sum + child.weight, 0), value: { label, children } };
  }).sort(compare);

  return { sectors: tile(sectors, { x: 0, y: 0, w: width, h: height }).map(({ value: sector, rect }) => {
    const headerHeight = rect.w >= 64 && rect.h >= 40 ? 16 : 0;
    const content = { ...rect, y: rect.y + headerHeight, h: rect.h - headerHeight };
    const industries = tile(sector.children, content).map(({ value: industry, rect: industryRect }) => {
      const industryHeaderHeight = industry.label && industryRect.w >= 56 && industryRect.h >= 28 ? 12 : 0;
      const industryContent = { ...industryRect, y: industryRect.y + industryHeaderHeight, h: industryRect.h - industryHeaderHeight };
      return {
        ...industryRect, id: JSON.stringify([sector.label, industry.label]), label: industry.label, headerHeight: industryHeaderHeight,
        cells: tile(industry.cells, industryContent).map(({ value: item, rect: cell }) => ({ ...item, ...cell })),
      };
    });
    return { ...rect, id: sector.label, label: sector.label, headerHeight, industries };
  }) };
}
