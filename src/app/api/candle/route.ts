import { NextRequest, NextResponse } from 'next/server';
import { logServerApi } from '@/lib/serverLogger';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  try {
    // Yahoo Finance chart API — works for US and KR stocks
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    const result = data?.chart?.result?.[0];

    if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
      return NextResponse.json({ s: 'no_data' });
    }

    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;

    // Filter out null values
    const t: number[] = [];
    const o: number[] = [];
    const h: number[] = [];
    const l: number[] = [];
    const c: number[] = [];
    const v: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close[i] != null && quote.open[i] != null) {
        t.push(timestamps[i]);
        o.push(quote.open[i]);
        h.push(quote.high[i]);
        l.push(quote.low[i]);
        c.push(quote.close[i]);
        v.push(quote.volume[i] || 0);
      }
    }

    logServerApi('api_candle', { symbol, points: t.length });
    return NextResponse.json({ s: 'ok', t, o, h, l, c, v });
  } catch (e) {
    console.error('Candle fetch error:', e);
    return NextResponse.json({ s: 'error' }, { status: 500 });
  }
}
