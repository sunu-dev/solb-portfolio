import type { CandleRaw } from '@/config/constants';
export type DailyCandleResult = { status:'ready'; data:CandleRaw } | { status:'empty'|'error'; data:null };
export function validDailyCandles(value: unknown): value is CandleRaw {
  if (!value || typeof value !== 'object') return false;
  const row = value as CandleRaw;
  return row.s === 'ok' && Array.isArray(row.t) && row.t.length > 0
    && row.t.every((t,i) => Number.isFinite(t) && (!i || t > row.t[i-1]))
    && [row.o,row.h,row.l,row.c,row.v].every(values => Array.isArray(values) && values.length === row.t.length && values.every(Number.isFinite));
}
/** Price history is useful before enough history exists for technical analysis. */
export async function readDailyCandles(symbol:string, request:typeof fetch=fetch):Promise<DailyCandleResult> {
  try {
    const response = await request(`/api/candle?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.timeout(12000)});
    if (!response.ok) return {status:'error',data:null};
    const value:unknown = await response.json();
    if (validDailyCandles(value)) return {status:'ready',data:value};
    return {status: (value as {s?:string})?.s === 'no_data' ? 'empty':'error',data:null};
  } catch { return {status:'error',data:null}; }
}
