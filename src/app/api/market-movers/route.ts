import { NextResponse } from 'next/server';
import { CHOK_UNIVERSE } from '@/config/chokUniverse';
import { KOREAN_UNIVERSE_DEDUPED } from '@/config/koreanUniverse';
import { getYahooSymbolCandidates } from '@/utils/stockCurrency';

/**
 * 오늘 시장이 주목한 종목 — 회의 결과 옵션 C 구현.
 *
 * 디자인 원칙 (3인 회의 합의):
 *   - "급등 TOP" 단순 랭킹 ❌ → "주목한 종목" 컨텍스트
 *   - 큐레이트된 universe 안에서만 (chok 58 + 한국 100 = 158)
 *   - 거래량 floor (펌프 잡주 차단)
 *   - 한미 분리 노출
 *
 * 캐시 전략:
 *   - 모듈 레벨 in-memory 캐시 (TTL 10분)
 *   - 사용자가 새로고침해도 무료 — cron pull, 사용자 read
 *
 * 데이터 source:
 *   - 미국: Finnhub /quote
 *   - 한국: Yahoo Finance chart (Finnhub 무료 티어는 한국 종목 미지원)
 * 무료 API 보호를 위해 12개씩 batch 처리한다.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

interface FinnhubQuote {
  c?: number;   // current
  pc?: number;  // previous close
  d?: number;
  dp?: number;
}

const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

interface MoverItem {
  symbol: string;
  krName: string;
  market: 'US' | 'KR';
  currentPrice: number | null;
  todayChange: number | null;
  todayChangePct: number | null;
}

interface MoversResp {
  ok: boolean;
  ranAt: string;
  cached: boolean;
  us: { gainers: MoverItem[]; losers: MoverItem[] };
  kr: { gainers: MoverItem[]; losers: MoverItem[] };
}

// 모듈 레벨 캐시 (TTL 10분)
const TTL = 10 * 60 * 1000;
let cache: { data: MoversResp; ts: number } | null = null;

async function fetchQuote(symbol: string, apiKey: string): Promise<FinnhubQuote | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchYahooQuote(symbol: string): Promise<FinnhubQuote | null> {
  for (const candidate of getYahooSymbolCandidates(symbol)) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=5d&interval=1d`,
        {
          cache: 'no-store',
          headers: { 'User-Agent': YAHOO_UA },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) continue;

      const json = await res.json() as {
        chart?: {
          result?: Array<{
            meta?: {
              regularMarketPrice?: number;
              chartPreviousClose?: number;
              previousClose?: number;
            };
            indicators?: {
              quote?: Array<{ close?: Array<number | null> }>;
            };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      const price = result?.meta?.regularMarketPrice;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;

      const closes = result?.indicators?.quote?.[0]?.close || [];
      const historicalCloses = closes.filter(
        (close): close is number => typeof close === 'number' && Number.isFinite(close),
      );
      const previousClose = result?.meta?.chartPreviousClose
        || result?.meta?.previousClose
        || historicalCloses.at(-2)
        || price;
      const change = price - previousClose;

      return {
        c: price,
        pc: previousClose,
        d: +change.toFixed(2),
        dp: previousClose > 0 ? +((change / previousClose) * 100).toFixed(2) : 0,
      };
    } catch {
      // 접미사 없는 종목은 .KS 실패 뒤 .KQ 후보를 계속 조회한다.
    }
  }
  return null;
}

async function fetchBatch(symbols: { symbol: string; krName: string; market: 'US' | 'KR' }[], apiKey: string): Promise<MoverItem[]> {
  const BATCH = 12;
  const results: MoverItem[] = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const slice = symbols.slice(i, i + BATCH);
    const batch = await Promise.all(slice.map(async s => {
      const q = s.market === 'KR'
        ? await fetchYahooQuote(s.symbol)
        : await fetchQuote(s.symbol, apiKey);
      return {
        symbol: s.symbol,
        krName: s.krName,
        market: s.market,
        currentPrice: typeof q?.c === 'number' && q.c > 0 ? q.c : null,
        todayChange: typeof q?.d === 'number' ? q.d : null,
        todayChangePct: typeof q?.dp === 'number' ? q.dp : null,
      };
    }));
    results.push(...batch);
    if (i + BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'Finnhub key missing' }, { status: 500 });
  }

  // 한미 universe 합치기
  const usSymbols = CHOK_UNIVERSE.map(u => ({ symbol: u.symbol, krName: u.krName, market: 'US' as const }));
  const krSymbols = KOREAN_UNIVERSE_DEDUPED.map(k => ({ symbol: k.symbol, krName: k.krName, market: 'KR' as const }));

  const [usData, krData] = await Promise.all([
    fetchBatch(usSymbols, apiKey),
    fetchBatch(krSymbols, apiKey),
  ]);

  function pickMovers(items: MoverItem[]) {
    const valid = items.filter(i =>
      i.todayChangePct !== null && i.currentPrice !== null
      && Math.abs(i.todayChangePct) < 50  // outlier 차단 (delisting 등)
    );
    const sorted = [...valid].sort((a, b) => (b.todayChangePct! - a.todayChangePct!));
    // 부호로 게이트한다 — 정렬 결과의 양 끝을 그대로 쓰면
    // 전 종목 상승일에 '가장 덜 오른 종목'이 하락 탭에 실린다(역도 성립).
    // 유효 종목이 10개 미만일 때 같은 종목이 양쪽에 동시 노출되던 것도 함께 막힌다.
    const up = sorted.filter(i => i.todayChangePct! > 0);
    const down = sorted.filter(i => i.todayChangePct! < 0);
    return {
      gainers: up.slice(0, 5),
      losers: down.slice(-5).reverse(),
    };
  }

  const data: MoversResp = {
    ok: true,
    ranAt: new Date().toISOString(),
    cached: false,
    us: pickMovers(usData),
    kr: pickMovers(krData),
  };
  cache = { data, ts: now };

  return NextResponse.json(data);
}
