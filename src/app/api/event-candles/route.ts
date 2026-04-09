import { NextRequest, NextResponse } from 'next/server';

interface CandleResult {
  s: 'ok' | 'no_data' | 'error';
  t?: number[];
  c?: number[];
}

async function fetchYahooHistorical(symbol: string, from: number, to: number): Promise<CandleResult> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${from}&period2=${to}&interval=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result?.indicators?.quote?.[0]) return { s: 'no_data' };

    const quote = result.indicators.quote[0];
    const t: number[] = [];
    const c: number[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      if (quote.close[i] != null) {
        t.push(result.timestamp[i]);
        c.push(quote.close[i]);
      }
    }
    return c.length > 0 ? { s: 'ok', t, c } : { s: 'no_data' };
  } catch {
    return { s: 'error' };
  }
}

export async function POST(req: NextRequest) {
  const { symbols, from, to } = await req.json() as { symbols: string[]; from: number; to?: number };
  if (!symbols?.length || !from) {
    return NextResponse.json({ error: 'symbols and from required' }, { status: 400 });
  }

  const toTs = to || Math.floor(Date.now() / 1000);
  const BATCH = 5;
  const results: Record<string, CandleResult> = {};

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(sym => fetchYahooHistorical(sym, from, toTs)));
    batch.forEach((sym, idx) => { results[sym] = batchResults[idx]; });
    if (i + BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // Historical data doesn't change — cache aggressively
  const isHistorical = toTs < Math.floor(Date.now() / 1000) - 86400;
  const cacheControl = isHistorical
    ? 's-maxage=86400, stale-while-revalidate=604800'
    : 's-maxage=900, stale-while-revalidate=3600';

  return NextResponse.json(results, { headers: { 'Cache-Control': cacheControl } });
}
