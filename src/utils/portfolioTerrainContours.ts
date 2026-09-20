interface ContourCell {
  weight: number;
  labelAnchor: { x: number; y: number; radius: number };
}

interface Point { x: number; y: number }

/** Periodic Catmull–Rom conversion keeps both position and tangent continuous. */
function smoothPath(points: Point[]): string {
  const coordinate = (value: number) => Number(value.toFixed(3));
  let path = `M${coordinate(points[0].x)},${coordinate(points[0].y)}`;
  for (let index = 0; index < points.length; index++) {
    const previous = points[(index - 1 + points.length) % points.length];
    const start = points[index], end = points[(index + 1) % points.length];
    const next = points[(index + 2) % points.length];
    path += `C${coordinate(start.x + (end.x - previous.x) / 6)},${coordinate(start.y + (end.y - previous.y) / 6)} ${coordinate(end.x - (next.x - start.x) / 6)},${coordinate(end.y - (next.y - start.y) / 6)} ${coordinate(end.x)},${coordinate(end.y)}`;
  }
  return `${path}Z`;
}

/**
 * Decorative terrain texture, not a chart of price, risk, or historical data.
 * Eleven closed contours form one asymmetric field across holding boundaries.
 * The focus and principal direction follow actual holding positions and weights.
 *
 * A broad radial warp creates nested organic rings, without small fragmented
 * loops or sharp petals. The caller clips the outer rings to the terrain.
 */
export function portfolioTerrainContours(cells: ContourCell[], width: number, height: number): string[] {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return [];
  const valid = cells.filter(cell => Number.isFinite(cell.weight) && cell.weight > 0
    && Number.isFinite(cell.labelAnchor.x) && Number.isFinite(cell.labelAnchor.y)
    && Number.isFinite(cell.labelAnchor.radius) && cell.labelAnchor.radius >= 0);
  if (!valid.length) return [];

  const maximumWeight = Math.max(...valid.map(cell => cell.weight));
  const influences = valid.map(cell => Math.sqrt(cell.weight / maximumWeight));
  const totalInfluence = influences.reduce((sum, influence) => sum + influence, 0);
  const dominant = valid.reduce((largest, cell) => cell.weight > largest.weight ? cell : largest).labelAnchor;
  let cx = 0, cy = 0, dx = 0, dy = 0;
  for (let index = 0; index < valid.length; index++) {
    const influence = influences[index] / totalInfluence;
    const anchor = valid[index].labelAnchor;
    // Clamp extreme external anchors; this texture is bounded to its own surface.
    const x = Math.max(0, Math.min(width, anchor.x));
    const y = Math.max(0, Math.min(height, anchor.y));
    cx += x * influence; cy += y * influence;
    dx += (x - dominant.x) / width * influence;
    dy += (y - dominant.y) / height * influence;
  }
  // A restrained offset leaves an asymmetric focal point instead of a bullseye.
  cx = cx * .6 + Math.max(0, Math.min(width, dominant.x)) * .4 - width * .055;
  cy = cy * .6 + Math.max(0, Math.min(height, dominant.y)) * .4 - height * .065;
  const axis = Math.hypot(dx, dy) > .001 ? Math.atan2(dy, dx) : -.6;

  return Array.from({ length: 11 }, (_, level) => {
    const scale = .11 + level * .122;
    const twist = .16 * Math.sin(level / 10 * Math.PI);
    const points = Array.from({ length: 32 }, (_, step) => {
      const angle = step * Math.PI / 16;
      const relative = angle - axis;
      // Only broad harmonics: the second stretches the field, the first and
      // third break symmetry, and a slow twist varies spacing between rings.
      const profile = 1 + .18 * Math.cos(2 * (relative + twist))
        + .085 * Math.sin(3 * relative + .45)
        + .105 * Math.cos(relative - .65);
      const radius = scale * profile;
      return { x: cx + Math.cos(angle) * width * .5 * radius, y: cy + Math.sin(angle) * height * .5 * radius };
    });
    return smoothPath(points);
  });
}
