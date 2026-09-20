export interface TerrainPoint { x: number; y: number }

export interface TerrainGeometry {
  points: TerrainPoint[];
  path: string;
  centroid: TerrainPoint;
  /** The centroid, also exposed as x/y for positioning HTML labels. */
  x: number;
  y: number;
  area: number;
  /** Radius of a circle centered at the centroid and wholly inside the territory. */
  radius: number;
  /** A larger, numerically searched interior disc for placing readable labels. */
  labelAnchor: TerrainPoint & { radius: number };
  bounds: { x: number; y: number; width: number; height: number };
}

type WeightedItem<T> = { item: T; weight: number };

function area(points: TerrainPoint[]): number {
  if (points.length < 3) return 0;
  const origin = points[0];
  let sum = 0;
  // Translate to a vertex to retain precision for tiny territories far from (0, 0).
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    sum += (a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y);
  }
  return Math.abs(sum) / 2;
}

function clip(points: TerrainPoint[], nx: number, ny: number, limit: number): TerrainPoint[] {
  const result: TerrainPoint[] = [];
  let previous = points[points.length - 1];
  let previousDistance = previous.x * nx + previous.y * ny - limit;
  for (const current of points) {
    const distance = current.x * nx + current.y * ny - limit;
    if ((distance <= 0) !== (previousDistance <= 0)) {
      const ratio = previousDistance / (previousDistance - distance);
      result.push({ x: previous.x + (current.x - previous.x) * ratio, y: previous.y + (current.y - previous.y) * ratio });
    }
    if (distance <= 0) result.push(current);
    previous = current;
    previousDistance = distance;
  }
  return result;
}

function split(points: TerrainPoint[], ratio: number, angle: number): [TerrainPoint[], TerrainPoint[]] {
  const nx = Math.cos(angle), ny = Math.sin(angle);
  const projections = points.map(point => point.x * nx + point.y * ny);
  let low = Math.min(...projections), high = Math.max(...projections);
  const target = area(points) * ratio;
  for (let i = 0; i < 54; i++) {
    const mid = (low + high) / 2;
    if (area(clip(points, nx, ny, mid)) < target) low = mid;
    else high = mid;
  }
  const limit = (low + high) / 2;
  return [clip(points, nx, ny, limit), clip(points, -nx, -ny, -limit)];
}

function compactness(points: TerrainPoint[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    perimeter += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return perimeter ** 2 / Math.max(area(points), Number.MIN_VALUE);
}

function geometry(points: TerrainPoint[]): TerrainGeometry {
  const origin = points[0];
  let signedArea = 0, cx = 0, cy = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const ax = points[i].x - origin.x, ay = points[i].y - origin.y;
    const bx = points[i + 1].x - origin.x, by = points[i + 1].y - origin.y;
    const cross = ax * by - bx * ay;
    signedArea += cross;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }
  const centroid = { x: origin.x + cx / (3 * signedArea), y: origin.y + cy / (3 * signedArea) };
  let radius = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 0) radius = Math.min(radius, Math.abs((b.x - a.x) * (centroid.y - a.y) - (b.y - a.y) * (centroid.x - a.x)) / length);
  }
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const bounds = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  const edges = points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length], length = Math.hypot(b.x - a.x, b.y - a.y);
    return length > 0 ? [{ x: a.x, y: a.y, nx: (a.y - b.y) / length, ny: (b.x - a.x) / length }] : [];
  });
  const interiorDistance = (px: number, py: number) => {
    let distance = Infinity;
    for (const edge of edges) distance = Math.min(distance, (px - edge.x) * edge.nx + (py - edge.y) * edge.ny);
    return distance;
  };
  let labelAnchor = { ...centroid, radius };
  let searchX = x + bounds.width / 2, searchY = y + bounds.height / 2;
  let spanX = bounds.width / 2, spanY = bounds.height / 2;
  // A fixed grid refinement is deterministic and cheap at typical holding counts.
  // It improves text room in small curved caps without modifying their true area.
  for (let pass = 0; pass < 6; pass++) {
    for (let column = -4; column <= 4; column++) {
      for (let row = -4; row <= 4; row++) {
        const px = searchX + column * spanX / 4, py = searchY + row * spanY / 4;
        const candidateRadius = interiorDistance(px, py);
        if (candidateRadius > labelAnchor.radius) labelAnchor = { x: px, y: py, radius: candidateRadius };
      }
    }
    searchX = labelAnchor.x; searchY = labelAnchor.y;
    spanX /= 2; spanY /= 2;
  }
  return {
    points,
    // Keep full precision: rounding disproportionately changes very small holdings.
    path: `M${points.map(point => `${point.x},${point.y}`).join('L')}Z`,
    centroid, x: centroid.x, y: centroid.y, area: Math.abs(signedArea) / 2, radius, labelAnchor, bounds,
  };
}

/**
 * Partitions one elliptical landscape into convex, contiguous territories.
 * Territory area is proportional to weight; thin/small holdings are never enlarged.
 * Three repeated cutting directions give the landscape a deliberate visual rhythm.
 * Candidate directions are scored for compactness, with depth breaking close ties.
 */
export function layoutPortfolioTerrain<T extends { symbol: string; weight: number }>(items: T[], width: number, height: number): (T & TerrainGeometry)[] {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return [];
  const valid = items.filter(item => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => b.weight - a.weight || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  if (!valid.length) return [];
  // Normalize before summing so several very large finite weights cannot overflow.
  const weighted = valid.map(item => ({ item, weight: item.weight / valid[0].weight }));
  const padding = Math.min(8, width / 20, height / 20);
  const rx = width / 2 - padding, ry = height / 2 - padding;
  const boundary = Array.from({ length: 128 }, (_, index) => {
    const angle = index * Math.PI / 64;
    return { x: width / 2 + Math.cos(angle) * rx, y: height / 2 + Math.sin(angle) * ry };
  });
  const result: (T & TerrainGeometry)[] = [];

  function partition(group: WeightedItem<T>[], polygon: TerrainPoint[], depth: number, branch: number) {
    if (group.length === 1) {
      result.push({ ...group[0].item, ...geometry(polygon) });
      return;
    }
    const total = group.reduce((sum, entry) => sum + entry.weight, 0);
    let prefix = 0, leftWeight = 0, splitIndex = 1, nearest = Infinity;
    for (let index = 1; index < group.length; index++) {
      prefix += group[index - 1].weight;
      const distance = Math.abs(total / 2 - prefix);
      if (distance < nearest) { nearest = distance; splitIndex = index; leftWeight = prefix; }
    }
    const ratio = leftWeight / total;
    const angles = [-24, 28, 90].map(degrees => degrees * Math.PI / 180);
    const preferredDirection = (depth + branch) % angles.length;
    let best: [TerrainPoint[], TerrainPoint[]] | undefined;
    let bestScore = Infinity;
    for (let candidate = 0; candidate < angles.length; candidate++) {
      const direction = (preferredDirection + candidate) % angles.length;
      const pieces = split(polygon, ratio, angles[direction]);
      // Area weighting keeps the major territories readable. A small unweighted
      // term prevents a tiny holding from becoming an unnecessarily narrow sliver.
      const score = (ratio + .12) * compactness(pieces[0]) + (1 - ratio + .12) * compactness(pieces[1]) + candidate * .04;
      if (score < bestScore) { bestScore = score; best = pieces; }
    }
    if (!best) return;
    partition(group.slice(0, splitIndex), best[0], depth + 1, branch * 2 + 1);
    partition(group.slice(splitIndex), best[1], depth + 1, branch * 2 + 2);
  }

  partition(weighted, boundary, 0, 0);
  return result;
}
