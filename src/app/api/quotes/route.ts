import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

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

export async function POST(req: NextRequest) {
  try {
    const { symbols, apiKey, macro } = await req.json() as {
      symbols: string[];
      apiKey: string;
      macro?: boolean;
    };

    if (!symbols?.length || !apiKey) {
      return NextResponse.json({ error: 'symbols and apiKey required' }, { status: 400 });
    }

    // Limit to 50 symbols max
    const syms = symbols.slice(0, 50);

    // Fetch all quotes in parallel from the server (US→US, fast)
    const results: Record<string, QuoteResult | null> = {};

    await Promise.all(
      syms.map(async (symbol) => {
        try {
          const r = await fetch(
            `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
            { signal: AbortSignal.timeout(5000) }
          );
          const d: QuoteResult = await r.json();
          if (d?.c) {
            results[symbol] = d;
          }
        } catch {
          results[symbol] = null;
        }
      })
    );

    // Also fetch USD/KRW if macro requested
    let usdKrw = null;
    if (macro) {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?range=5d&interval=1d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            signal: AbortSignal.timeout(5000),
          }
        );
        const data = await r.json();
        const result = data?.chart?.result?.[0];
        if (result) {
          const meta = result.meta;
          const closes = result.indicators?.quote?.[0]?.close?.filter((v: number | null) => v != null) || [];
          const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta.chartPreviousClose;
          const price = meta.regularMarketPrice;
          usdKrw = {
            c: price,
            d: prevClose ? +(price - prevClose).toFixed(2) : 0,
            dp: prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0,
          };
        }
      } catch { /* silent */ }
    }

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
