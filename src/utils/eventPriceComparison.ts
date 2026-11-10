import type { EventCacheEntry } from '@/config/constants';

interface EventCandles { c?: number[]; t?: number[] }

/** Compare only the requested historical window; a closed event never uses today's quote. */
export function eventPriceComparison(candles: EventCandles, ongoing: boolean, currentPrice?: number, requestedBaseDate?: string): EventCacheEntry | null {
  let dated = (candles.c ?? []).flatMap((close, index) => {
    const time = candles.t?.[index];
    return Number.isFinite(close) && close > 0 && (!requestedBaseDate || (typeof time === 'number' && Number.isFinite(time) && time > 0))
      ? [{ close, time }] : [];
  });
  const dateOf = (time?: number) => {
    const date = typeof time === 'number' && Number.isFinite(time) ? new Date(time * 1000) : undefined;
    return date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
  };
  if (requestedBaseDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedBaseDate) || dateOf(Date.parse(requestedBaseDate) / 1000) !== requestedBaseDate) return null;
    dated = dated.filter(point => Number.isFinite(new Date(point.time! * 1000).getTime())).sort((a, b) => a.time! - b.time!);
    // Some providers append a second observation for the current session. It is one day, not two.
    dated = [...new Map(dated.map(point => [dateOf(point.time), point])).values()];
  }
  const baseIndex = requestedBaseDate ? dated.findLastIndex(point => dateOf(point.time)! <= requestedBaseDate) : 0;
  if (baseIndex < 0) return null; // An IPO after the event cannot establish a pre-event price.
  const points = dated.slice(baseIndex);
  if (points.length < 2) return null;
  const basePrice = points[0].close;
  const low = Math.min(...points.map(point => point.close));
  const lowIndex = points.findIndex(point => point.close === low);
  const recoveryIndex = low < basePrice ? points.findIndex((point, index) => index > lowIndex && point.close >= basePrice) : -1;
  const hasCurrentPrice = ongoing && typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0;
  const last = hasCurrentPrice ? currentPrice : points[points.length - 1].close;
  const lowTime = points[lowIndex].time;
  return {
    basePrice,
    baseDate: dateOf(points[0].time),
    lastDate: dateOf(points[points.length - 1].time),
    lastPrice: last,
    maxDrop: (low - basePrice) / basePrice * 100,
    maxDropPrice: low,
    maxDropDate: dateOf(lowTime),
    currentChange: (last - basePrice) / basePrice * 100,
    recovered: low < basePrice && (recoveryIndex !== -1 || (hasCurrentPrice && currentPrice >= basePrice)),
    recoveryDays: recoveryIndex !== -1 ? recoveryIndex : null,
    recoveryDate: recoveryIndex !== -1 ? dateOf(points[recoveryIndex].time) : undefined,
    dataSource: 'fetched',
  };
}
