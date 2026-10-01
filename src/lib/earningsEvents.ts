import { unstable_cache } from 'next/cache';
import type { EconomicEvent } from './economicEvents';
import { zonedIso } from './economicSources';
interface EarningsRow { symbol: string; date: string; hour?: string; year?: number; quarter?: number; epsActual?: number | null; epsEstimate?: number | null; revenueActual?: number | null }
export function toEarningsEvent(row: EarningsRow): EconomicEvent | null {
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null;
  const actual = typeof row.epsActual === 'number' && Number.isFinite(row.epsActual) ? row.epsActual : null;
  const forecast = typeof row.epsEstimate === 'number' && Number.isFinite(row.epsEstimate) ? row.epsEstimate : null;
  // Provider supplies session/date, never an exact release time. Keep that uncertainty visible.
  return { key: `earnings:${row.symbol}:${row.year || row.date.slice(0,4)}:${row.quarter || row.date}`, kind: 'earnings', symbol: row.symbol, title: `${row.symbol} 실적 발표`,
    at: zonedIso(row.date, row.hour === 'amc' ? '16:00' : '09:30'), timeKnown: false,
    timingNote: `미국 ${row.date.slice(5).replace('-','/')} ${row.hour === 'amc' ? '장 마감 후' : row.hour === 'bmo' ? '장 시작 전' : '시각 미정'} · 정확한 한국시간 미정`,
    sourceUrl: 'https://finnhub.io/calendar',
    ...(actual !== null ? { result: { headline: `${row.symbol}의 주당순이익은 $${actual.toFixed(2)}예요.`, actual: `$${actual.toFixed(2)}`, forecast: forecast === null ? undefined : `$${forecast.toFixed(2)}`, sourceUrl: 'https://finnhub.io/calendar', note: 'Finnhub 실적 자료. 예상치와 실제치의 회계 기준을 기업 발표문과 함께 확인해보세요.' } } : {}) };
}
export const getEarningsEvents = unstable_cache(async (symbol: string, from: string, to: string) => {
  const key = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) throw new Error('earnings unavailable');
  const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('earnings unavailable');
  const data = await r.json();
  if (!Array.isArray(data.earningsCalendar)) throw new Error('earnings unavailable');
  return (data.earningsCalendar as EarningsRow[]).filter(row => row.symbol === symbol).map(toEarningsEvent).filter((e): e is EconomicEvent => !!e);
}, ['earnings-events-v1'], { revalidate: 900 });
