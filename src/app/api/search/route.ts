import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logServerApi } from '@/lib/serverLogger';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// 6개월 이내 신규 상장 = "신규 상장" 배지 노출
const NEW_LISTING_WINDOW_MS = 180 * 86400 * 1000;

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
})();

interface SearchResultItem {
  symbol: string;
  description: string;
  isNewListing?: boolean;
  listedAt?: string | null;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ result: [] });
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ result: [] });
  }

  try {
    const r = await fetch(
      `${FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json();
    const baseResults: SearchResultItem[] = (d.result || [])
      .filter((item: { type: string }) => item.type === 'Common Stock' || item.type === 'ETP')
      .slice(0, 8)
      .map((item: { symbol: string; description: string }) => ({
        symbol: item.symbol,
        description: item.description,
      }));

    // stock_listings에서 신규 상장 정보 조회 (1 query, in 절)
    if (supabaseAdmin && baseResults.length > 0) {
      const syms = baseResults.map(r => r.symbol);
      try {
        const { data: listings } = await supabaseAdmin
          .from('stock_listings')
          .select('symbol, listed_at, first_seen')
          .in('symbol', syms);
        const existingMap = new Map((listings || []).map(l => [(l as { symbol: string }).symbol, l]));
        const cutoff = Date.now() - NEW_LISTING_WINDOW_MS;
        for (const item of baseResults) {
          const l = existingMap.get(item.symbol) as { listed_at: string | null; first_seen: string } | undefined;
          // listed_at 만 신뢰 — first_seen은 cron이 처음 감지한 시점이라 IPO일 아님
          if (l?.listed_at) {
            const refTime = new Date(l.listed_at).getTime();
            if (refTime > cutoff) {
              item.isNewListing = true;
              item.listedAt = l.listed_at;
            }
          }
        }

        // P0-9 — Finnhub 미지원 한국 거래소(.KS/.KQ) 우회 등록
        // 사용자 검색 결과 중 한국 종목으로 stock_listings에 없는 것 자동 insert
        // (KRX 자동 cron 미구현 대안 — 사용자 검색이 곧 universe 후보 발견)
        const koreanNewRows = baseResults
          .filter(r => (r.symbol.endsWith('.KS') || r.symbol.endsWith('.KQ')) && !existingMap.has(r.symbol))
          .map(r => ({
            symbol: r.symbol,
            exchange: r.symbol.endsWith('.KS') ? 'KS' : 'KQ',
            description: r.description,
            status: 'watch',
          }));
        if (koreanNewRows.length > 0) {
          await supabaseAdmin
            .from('stock_listings')
            .insert(koreanNewRows)
            .then(() => null, () => null); // 동시 검색 race 방지: 실패 silent
        }
      } catch { /* stock_listings 테이블 없으면 silent */ }
    }

    logServerApi('api_search', { query, result_count: baseResults.length });

    return NextResponse.json({ result: baseResults }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ result: [] });
  }
}
