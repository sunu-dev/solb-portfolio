import type { CandleRaw } from '@/config/constants';

export interface IntradayCandles extends CandleRaw {
  s: 'ok';
  sessionDate: string;
  timeZone: string;
  interval: '5m';
  asOf: number;
}
interface YahooIntradayResult {
  meta?: { exchangeTimezoneName?: string };
  timestamp?: unknown[];
  indicators?: { quote?: { open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[]; volume?: unknown[] }[] };
}
export function tradingDate(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp * 1000));
}

/** Yahoo is requested with includePrePost=false. Never mix sessions or fabricate missing bars. */
export function latestIntradaySession(input: YahooIntradayResult, now = Date.now()): IntradayCandles | null {
  const timeZone = input.meta?.exchangeTimezoneName;
  if (!timeZone) return null;
  try { tradingDate(now / 1000, timeZone); } catch { return null; }
  const quote = input.indicators?.quote?.[0];
  if (!quote || !Array.isArray(input.timestamp)) return null;
  const bars = new Map<number, { t: number; o: number; h: number; l: number; c: number; v: number }>();
  input.timestamp.forEach((timestamp, i) => {
    const values = [timestamp, quote.open?.[i], quote.high?.[i], quote.low?.[i], quote.close?.[i]];
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) return;
    const [t, o, h, l, c] = values as number[];
    if (t <= 0 || t > now / 1000 + 60 || Math.min(o, h, l, c) <= 0 || h < Math.max(o, c) || l > Math.min(o, c)) return;
    const volume = quote.volume?.[i];
    bars.set(t, { t, o, h, l, c, v: typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 ? volume : 0 });
  });
  const sorted = [...bars.values()].sort((a, b) => a.t - b.t);
  if (!sorted.length) return null;
  const sessionDate = tradingDate(sorted.at(-1)!.t, timeZone);
  const session = sorted.filter(bar => tradingDate(bar.t, timeZone) === sessionDate);
  return { s: 'ok', sessionDate, timeZone, interval: '5m', asOf: session.at(-1)!.t,
    t: session.map(bar => bar.t), o: session.map(bar => bar.o), h: session.map(bar => bar.h),
    l: session.map(bar => bar.l), c: session.map(bar => bar.c), v: session.map(bar => bar.v) };
}
