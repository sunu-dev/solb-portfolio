import type { CandleRaw } from '@/config/constants';

/** Only received closing prices are plotted. Missing history is not a flat line. */
export function portfolioPriceHistory(candles?: CandleRaw) {
  if (!candles || candles.s !== 'ok' || !Array.isArray(candles.c) || !Array.isArray(candles.t) || candles.c.length !== candles.t.length) return null;
  const byTime = new Map<number, number>();
  candles.c.forEach((price, index) => {
    const time = candles.t[index];
    if (Number.isFinite(price) && price > 0 && Number.isFinite(time) && time > 0 && time < 8.64e12) byTime.set(time, price);
  });
  const points = [...byTime].sort(([a], [b]) => a - b).slice(-30);
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const low = Math.min(...points.map(([, price]) => price));
  const high = Math.max(...points.map(([, price]) => price));
  const range = high - low;
  const coordinates = points.map(([time, price]) => [
    (time - first[0]) / (last[0] - first[0]) * 240,
    range > 0 ? 52 - (price - low) / range * 40 : 32,
  ]);
  const line = coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const date = (time: number) => { const d = new Date(time * 1000); return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`; };
  return { line, area: `${line} L240,64 L0,64 Z`, start: date(first[0]), end: date(last[0]), change: (last[1] / first[1] - 1) * 100, count: points.length };
}
