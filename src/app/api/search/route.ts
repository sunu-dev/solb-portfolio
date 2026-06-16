import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logServerApi } from '@/lib/serverLogger';
import { isSingleStockLeverage } from '@/utils/leverageGuard';

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
  /** 서버 권위 단일종목 레버리지 플래그 — 클라이언트 라벨/게이트가 로컬 재계산에만 의존하지 않도록.
   *  클라이언트는 (서버 플래그 OR 로컬 재계산) 합집합으로 표시한다. */
  isLeverage?: boolean;
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
    // 통화 환산 인프라가 USD ↔ KRW만 지원 → 그 외 거래소(.T 도쿄·.HK·.L 런던 등) 차단.
    // suffix 없음 = US(USD), .KS/.KQ = 한국(KRW)만 허용. 등록되면 KRW 환산이 깨져 거짓 손익 발생.
    // '중간 옵션'(2026-05-29): 단일종목 레버리지도 검색 '표시'는 허용한다 (보유 입력용).
    // 단 아래 universe 자동 등록(koreanNewRows)에서는 제외 — 신규 발굴 표면이므로 차단.
    const baseResults: SearchResultItem[] = (d.result || [])
      .filter((item: { type: string; symbol: string; description?: string }) => {
        if (item.type !== 'Common Stock' && item.type !== 'ETP') return false;
        const sym = String(item.symbol || '');
        if (sym.includes('.')) {
          if (!(sym.endsWith('.KS') || sym.endsWith('.KQ'))) return false;
        }
        return true;
      })
      .slice(0, 8)
      .map((item: { symbol: string; description: string }) => ({
        symbol: item.symbol,
        description: item.description,
        // 순수 함수 — 비용·부작용 없음. 클라이언트 라벨/게이트의 서버측 SSOT.
        isLeverage: isSingleStockLeverage(item.symbol, item.description),
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
          .filter(r => (r.symbol.endsWith('.KS') || r.symbol.endsWith('.KQ')) && !existingMap.has(r.symbol)
            && !isSingleStockLeverage(r.symbol, r.description)) // 레버리지는 universe 진입 금지 (신규 발굴 차단)
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
