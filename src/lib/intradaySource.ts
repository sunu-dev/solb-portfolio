import { createHash } from 'node:crypto';
import { latestIntradaySession, type IntradayCandles } from './intradayCandles';
import { getYahooSymbolCandidates } from '@/utils/stockCurrency';

export function intradaySnapshotId(data: IntradayCandles): string {
  return createHash('sha256').update(JSON.stringify(['intraday-v1', data.sessionDate, data.timeZone, data.t, data.o, data.h, data.l, data.c, data.v])).digest('hex');
}

/** Shared public source for the chart and its explanation. Never accept a browser's price series as evidence. */
export async function readLatestIntraday(symbol: string): Promise<
  { status: 'ok'; data: IntradayCandles; resolvedSymbol: string } | { status: 'none' | 'unavailable' }
> {
  let failed = false;
  for (const candidate of getYahooSymbolCandidates(symbol)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=5d&interval=5m&includePrePost=false`;
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) { failed = true; continue; }
      const body = await response.json();
      const data = latestIntradaySession(body?.chart?.result?.[0] ?? {});
      if (data) return { status: 'ok', data: { ...data, snapshotId: intradaySnapshotId(data), receivedAt: Date.now() }, resolvedSymbol: candidate };
    } catch { failed = true; }
  }
  return { status: failed ? 'unavailable' : 'none' };
}
