import type { EventCacheEntry } from '@/config/constants';

interface EventCandles { c?: number[]; t?: number[] }

/** Compare only the requested historical window; a closed event never uses today's quote. */
export function eventPriceComparison(candles: EventCandles, ongoing: boolean, currentPrice?: number): EventCacheEntry | null {
  const points = (candles.c ?? []).flatMap((close, index) => Number.isFinite(close) && close > 0
    ? [{ close, time: candles.t?.[index] }] : []);
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
    maxDrop: (low - basePrice) / basePrice * 100,
    maxDropPrice: low,
    maxDropDate: lowTime && Number.isFinite(lowTime) ? new Date(lowTime * 1000).toISOString().split('T')[0] : undefined,
    currentChange: (last - basePrice) / basePrice * 100,
    recovered: low < basePrice && (recoveryIndex !== -1 || (hasCurrentPrice && currentPrice >= basePrice)),
    recoveryDays: recoveryIndex !== -1 ? recoveryIndex : null,
    dataSource: 'fetched',
  };
}
