import type { QuoteData } from '@/config/constants';
import { yahooPreviousClose } from './yahooPreviousClose';

export type YahooQuote = Omit<QuoteData, 'd' | 'dp' | 'pc'> & {
  d: number | null;
  dp: number | null;
  pc: number | null;
};

type YahooChart = Parameters<typeof yahooPreviousClose>[0] & {
  meta?: {
    regularMarketPrice?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketOpen?: number;
    regularMarketTime?: number;
  };
};

/** FX conversion needs the current rate even when the daily comparison is unavailable. */
export function buildYahooQuote(result: YahooChart, allowMissingPreviousClose = false): YahooQuote | null {
  const meta = result.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const previous = yahooPreviousClose(result);
  if (previous === null && !allowMissingPreviousClose) return null;
  const positive = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : price;
  return {
    c: price,
    d: previous === null ? null : +(price - previous).toFixed(2),
    dp: previous === null ? null : +((price - previous) / previous * 100).toFixed(2),
    pc: previous,
    h: positive(meta?.regularMarketDayHigh),
    l: positive(meta?.regularMarketDayLow),
    o: positive(meta?.regularMarketOpen),
    t: typeof meta?.regularMarketTime === 'number' && Number.isFinite(meta.regularMarketTime) ? meta.regularMarketTime : 0,
  };
}
