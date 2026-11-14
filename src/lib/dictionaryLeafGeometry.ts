/** A flexible leaf hinged at u=0. Coordinates are in leaf widths. */
export function dictionaryLeafCurve(progress: number, segments = 64) {
  const angle = Math.PI * Math.max(0, Math.min(1, progress));
  const bend = .65 * Math.sin(angle);
  const points = [{ u: 0, x: 0, z: 0, normal: Math.cos(angle - bend / 2) }];
  let x = 0, z = 0;
  for (let i = 1; i <= segments; i++) {
    const u = i / segments;
    const tangent = angle + bend * ((i - .5) / segments - .5);
    x += Math.cos(tangent) / segments;
    z += Math.sin(tangent) / segments;
    points.push({ u, x, z, normal: Math.cos(angle + bend * (u - .5)) });
  }
  return points;
}
