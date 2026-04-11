import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

// Yahoo Finance symbol mapping for indices
const YAHOO_INDEX_MAP: Record<string, string> = {
  '^GSPC': '%5EGSPC',
  '^IXIC': '%5EIXIC',
  '^VIX': '%5EVIX',
  '^KS11': '%5EKS11',
  'USOIL': 'CL=F',
};

interface QuoteResult {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

async function fetchFromYahoo(symbol: string): Promise<QuoteResult | null> {
  const yahooSymbol = YAHOO_INDEX_MAP[symbol] || symbol;
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=5d&interval=1d`,
      { headers: { 'User-Agent': YAHOO_UA }, signal: AbortSignal.timeout(5000) }
    );
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    if (!price) return null;

    const change = prevClose ? +(price - prevClose).toFixed(2) : 0;
    const changePct = prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

    return {
      c: price,
      d: change,
      dp: changePct,
      h: meta.regularMarketDayHigh || price,
      l: meta.regularMarketDayLow || price,
      o: meta.regularMarketOpen || price,
      pc: prevClose || price,
      t: Math.floor(Date.now() / 1000),
    };
  } catch { return null; }
}

async function fetchFromFinnhub(symbol: string, apiKey: string): Promise<QuoteResult | null> {
  try {
    const r = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const d: QuoteResult = await r.json();
    return d?.c ? d : null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { symbols, macro } = await req.json() as {
      symbols: string[];
      macro?: boolean;
    };

    // 서버 전용 키 우선, fallback으로 NEXT_PUBLIC_ 사용 (클라이언트 번들에는 포함 안 됨)
    const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';

    if (!symbols?.length || !apiKey) {
      return NextResponse.json({ error: 'symbols required' }, { status: 400 });
    }

    const syms = symbols.slice(0, 50);
    const results: Record<string, QuoteResult | null> = {};

    // Split: index symbols → Yahoo Finance, regular stocks → Finnhub
    const indexSymbols = syms.filter(s => s.startsWith('^') || YAHOO_INDEX_MAP[s]);
    const stockSymbols = syms.filter(s => !s.startsWith('^') && !YAHOO_INDEX_MAP[s]);

    let usdKrw: { c: number; d: number; dp: number } | null = null;

    await Promise.all([
      // Index quotes via Yahoo Finance (Finnhub free tier doesn't support indices)
      ...indexSymbols.map(async (symbol) => {
        results[symbol] = await fetchFromYahoo(symbol);
      }),
      // Stock quotes via Finnhub
      ...stockSymbols.map(async (symbol) => {
        results[symbol] = await fetchFromFinnhub(symbol, apiKey);
      }),
      // USD/KRW 병렬 처리 (기존 순차 제거)
      ...(macro ? [fetchFromYahoo('USDKRW=X').then(q => {
        if (q) usdKrw = { c: q.c, d: q.d, dp: q.dp };
      })] : []),
    ]);

    return NextResponse.json(
      { quotes: results, usdKrw },
      {
        headers: {
          'Cache-Control': 's-maxage=15, stale-while-revalidate=30',
        },
      }
    );
  } catch (e) {
    console.error('Batch quotes error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
