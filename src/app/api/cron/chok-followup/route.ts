import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * AI 촉 백테스트 follow-up cron.
 *
 * 동작:
 * - 매일 KST 새벽 02:30 (= UTC 17:30) 실행
 * - ai_chok_recommendations 테이블에서 30일/90일 도달 + filled 안 된 row 추출
 * - 현재가 페치 후 return_30d / return_90d 계산해 채움
 *
 * 등록: vercel.json crons에 "0 17 * * *"
 *
 * 인프라 의존:
 * - SUPABASE_SERVICE_KEY: RLS 우회 (백테스트 fill은 시스템 작업)
 * - FINNHUB_API_KEY: 가격 조회
 * - CRON_SECRET: Vercel Cron 인증
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function fetchPrice(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d?.c !== 'number' || d.c <= 0) return null;
    return d.c;
  } catch {
    return null;
  }
}

interface RecRow {
  id: string;
  symbol: string;
  current_price: number | null;
  recommended_at: string;
  filled_30d_at: string | null;
  filled_90d_at: string | null;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Finnhub key missing' }, { status: 500 });
  }

  const db = getAdmin();
  const stats = { scanned: 0, filled30: 0, filled90: 0, errors: [] as string[] };

  try {
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * 86400_000).toISOString();
    const cutoff90 = new Date(now - 90 * 86400_000).toISOString();

    // 30일 도달 + 미충전 row
    const { data: pending30 } = await db
      .from('ai_chok_recommendations')
      .select('id, symbol, current_price, recommended_at, filled_30d_at, filled_90d_at')
      .lte('recommended_at', cutoff30)
      .is('filled_30d_at', null)
      .limit(500);

    // 90일 도달 + 미충전 row
    const { data: pending90 } = await db
      .from('ai_chok_recommendations')
      .select('id, symbol, current_price, recommended_at, filled_30d_at, filled_90d_at')
      .lte('recommended_at', cutoff90)
      .is('filled_90d_at', null)
      .limit(500);

    const all = [...(pending30 || []), ...(pending90 || [])] as RecRow[];
    stats.scanned = all.length;
    if (all.length === 0) {
      return NextResponse.json({ ok: true, ...stats, note: '채울 row 없음' });
    }

    // symbol 중복 제거 후 가격 한 번씩만 페치
    const uniqueSymbols = Array.from(new Set(all.map(r => r.symbol)));
    const priceCache: Record<string, number | null> = {};
    const fetchResults = await Promise.allSettled(
      uniqueSymbols.map(s => fetchPrice(s, apiKey))
    );
    uniqueSymbols.forEach((sym, i) => {
      const r = fetchResults[i];
      priceCache[sym] = r.status === 'fulfilled' ? r.value : null;
    });

    const nowIso = new Date().toISOString();

    // 30일 채움 (pending30)
    for (const row of (pending30 || []) as RecRow[]) {
      const currentPrice = priceCache[row.symbol];
      if (currentPrice === null || currentPrice === undefined) continue;
      const baseline = row.current_price;
      const ret = baseline && baseline > 0
        ? ((currentPrice - baseline) / baseline) * 100
        : null;
      const { error } = await db
        .from('ai_chok_recommendations')
        .update({
          price_after_30d: currentPrice,
          return_30d: ret,
          filled_30d_at: nowIso,
        })
        .eq('id', row.id);
      if (error) stats.errors.push(`30d ${row.id}: ${error.message}`);
      else stats.filled30++;
    }

    // 90일 채움 (pending90)
    for (const row of (pending90 || []) as RecRow[]) {
      const currentPrice = priceCache[row.symbol];
      if (currentPrice === null || currentPrice === undefined) continue;
      const baseline = row.current_price;
      const ret = baseline && baseline > 0
        ? ((currentPrice - baseline) / baseline) * 100
        : null;
      const { error } = await db
        .from('ai_chok_recommendations')
        .update({
          price_after_90d: currentPrice,
          return_90d: ret,
          filled_90d_at: nowIso,
        })
        .eq('id', row.id);
      if (error) stats.errors.push(`90d ${row.id}: ${error.message}`);
      else stats.filled90++;
    }

    return NextResponse.json({ ok: true, ranAt: nowIso, ...stats });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ...stats,
    }, { status: 500 });
  }
}
