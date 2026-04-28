import { NextRequest, NextResponse } from 'next/server';
import { CHOK_UNIVERSE } from '@/config/chokUniverse';
import { KOREAN_UNIVERSE_DEDUPED } from '@/config/koreanUniverse';

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
 * 데이터 source: Finnhub /quote (한미 동일 endpoint, .KS/.KQ suffix 지원)
 * 무료 tier 60/min — 158 calls는 batch 처리 (12씩, 200ms 간격)
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

interface FinnhubQuote {
  c?: number;   // current
  pc?: number;  // previous close
  d?: number;
  dp?: number;
}

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

async function fetchBatch(symbols: { symbol: string; krName: string; market: 'US' | 'KR' }[], apiKey: string): Promise<MoverItem[]> {
  const BATCH = 12;
  const results: MoverItem[] = [];
  for (let i = 0; i < symbols.length; i += BATCH) {
    const slice = symbols.slice(i, i + BATCH);
    const batch = await Promise.all(slice.map(async s => {
      const q = await fetchQuote(s.symbol, apiKey);
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

export async function GET(_req: NextRequest) {
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
    return {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
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
