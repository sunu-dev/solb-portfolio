import { NextRequest, NextResponse } from 'next/server';
import { readLatestIntraday } from '@/lib/intradaySource';
import { logServerApi } from '@/lib/serverLogger';
import { getYahooSymbolCandidates } from '@/utils/stockCurrency';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const intraday = req.nextUrl.searchParams.get('range') === '1d';
  if (intraday) {
    const result = await readLatestIntraday(symbol);
    if (result.status === 'ok') {
      logServerApi('api_candle', { symbol, resolved_symbol: result.resolvedSymbol, points: result.data.t.length, interval: '5m' });
      return NextResponse.json(result.data, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } });
    }
    return result.status === 'none' ? NextResponse.json({ s: 'no_data' }) : NextResponse.json({ s: 'error' }, { status: 500 });
  }
  let fetchFailed = false;

  for (const yahooSymbol of getYahooSymbolCandidates(symbol)) {
    try {
      // Yahoo Finance chart API — works for US and KR stocks.
      // 접미사 없는 6자리 한국 코드는 .KS → .KQ 순으로 조회한다.
      const period = 'range=1y&interval=1d';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?${period}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) { fetchFailed = true; continue; }
      const data = await resp.json();
      const result = data?.chart?.result?.[0];

      if (!result?.timestamp || !result?.indicators?.quote?.[0]) continue;

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
        if ([timestamps[i], quote.close[i], quote.open[i], quote.high[i], quote.low[i]].every(Number.isFinite)) {
          t.push(timestamps[i]);
          o.push(quote.open[i]);
          h.push(quote.high[i]);
          l.push(quote.low[i]);
          c.push(quote.close[i]);
          v.push(quote.volume[i] || 0);
        }
      }

      logServerApi('api_candle', {
        symbol,
        resolved_symbol: yahooSymbol,
        points: t.length,
      });
      return NextResponse.json(t.length ? { s: 'ok', t, o, h, l, c, v } : { s: 'no_data' });
    } catch (e) {
      fetchFailed = true;
      console.error('Candle fetch error:', e);
    }
  }

  return fetchFailed
    ? NextResponse.json({ s: 'error' }, { status: 500 })
    : NextResponse.json({ s: 'no_data' });
}
