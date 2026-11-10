import { after, NextResponse } from 'next/server';
import { boundedFetch } from '@/lib/boundedFetch';
import { buildYahooQuote, isMacroQuoteSymbol, type YahooQuote } from '@/utils/yahooQuote';
import { defineRoute, POLICIES } from '@/lib/apiRoute';
import { logServerApi } from '@/lib/serverLogger';
import {
  getYahooSymbolCandidates,
  isKoreanStockSymbol,
} from '@/utils/stockCurrency';

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

async function fetchFromYahoo(symbol: string): Promise<YahooQuote | null> {
  const yahooSymbol = YAHOO_INDEX_MAP[symbol] || symbol;
  try {
    const data = await boundedFetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=5d&interval=1d`,
      2500, response => response.json(), { headers: { 'User-Agent': YAHOO_UA } }
    );
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    return buildYahooQuote(result, isMacroQuoteSymbol(symbol));
  } catch { return null; }
}

async function fetchFromFinnhub(symbol: string, apiKey: string): Promise<QuoteResult | null> {
  if (!apiKey) return null;
  try {
    const d: QuoteResult = await boundedFetch(
      `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      1500, response => response.json()
    );
    return Number.isFinite(d?.c) && d.c > 0 ? d : null;
  } catch { return null; }
}

async function fetchBareKoreanCode(symbol: string): Promise<YahooQuote | null> {
  const quotes = await Promise.all(getYahooSymbolCandidates(symbol).map(fetchFromYahoo));
  return quotes.find(Boolean) ?? null;
}

// 미인증 공개 라우트 — 요청당 최대 50종목 Finnhub 호출.
export const POST = defineRoute({
  name: '/api/quotes',
  auth: 'public',
  rateLimit: POLICIES.general,
  deferLog: true,
  handler: async ({ req }) => {
  try {
    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { symbols, macro } = (body ?? {}) as {
      symbols: string[];
      macro?: boolean;
    };

    // 서버 전용 키 우선, fallback으로 NEXT_PUBLIC_ 사용 (클라이언트 번들에는 포함 안 됨)
    const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';

    if (!Array.isArray(symbols) || symbols.length === 0 || symbols.length > 50
      || symbols.some(s => typeof s !== 'string' || !/^[A-Za-z0-9^=.\-]{1,32}$/.test(s))) {
      return NextResponse.json({ error: 'symbols required' }, { status: 400 });
    }

    const syms = [...new Set(symbols)];
    const results: Record<string, QuoteResult | YahooQuote | null> = {};

    // Split: index/한국(.KS/.KQ) → Yahoo Finance, 미국 stocks → Finnhub.
    // 한국 종목을 Yahoo로 보내는 이유: Finnhub 무료 티어는 .KS/.KQ 미지원이라 배치에서 null이
    // 되고, 배치가 (미국 종목으로) 성공 처리되면 useStockData의 KR fallback이 스킵돼
    // 한국 종목 시세가 영영 안 채워진다(무한 스켈레톤). Yahoo는 .KS를 정상 처리(kr-quote와 동일).
    const isYahooSym = (s: string) =>
      s.startsWith('^') || !!YAHOO_INDEX_MAP[s] || isKoreanStockSymbol(s);
    const indexSymbols = syms.filter(isYahooSym);
    const stockSymbols = syms.filter(s => !isYahooSym(s));

    let usdKrw: { c: number; d: number | null; dp: number | null } | null = null;

    await Promise.all([
      // Index quotes via Yahoo Finance (Finnhub free tier doesn't support indices)
      ...indexSymbols.map(async (symbol) => {
        results[symbol] = /^\d{6}$/.test(symbol)
          ? await fetchBareKoreanCode(symbol)
          : await fetchFromYahoo(symbol);
      }),
      // Stock quotes via Finnhub
      ...stockSymbols.map(async (symbol) => {
        results[symbol] = await fetchFromFinnhub(symbol, apiKey) ?? await fetchFromYahoo(symbol);
      }),
      // USD/KRW 병렬 처리 (기존 순차 제거)
      ...(macro ? [fetchFromYahoo('USDKRW=X').then(q => {
        if (q) usdKrw = { c: q.c, d: q.d, dp: q.dp };
      })] : []),
    ]);

    // API 호출 로깅 (비동기, 응답 차단하지 않음)
    after(() => logServerApi('api_quotes', {
      finnhub_count: stockSymbols.length,
      yahoo_count: indexSymbols.length + (macro ? 1 : 0),
      total: syms.length,
    }));

    return NextResponse.json(
      { quotes: results, usdKrw },
      {
        headers: {
          // POST responses are not CDN-cached. Do not imply that errors are reusable.
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (e) {
    console.error('Batch quotes error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
},
});
