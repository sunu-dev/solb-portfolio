import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 신규 상장 종목 메타데이터(시총·상장일) 점진 채움 cron
 *
 * 동작:
 * 1. stock_listings에서 market_cap IS NULL AND status IN ('watch','eligible') 50건 조회
 *    (오래된 것 우선 — first_seen ASC)
 * 2. 각 종목 Finnhub /stock/profile2 호출 → marketCapitalization (M USD), ipo
 * 3. DB 업데이트 (market_cap = M USD * 1e6, listed_at = ipo)
 *
 * 제약:
 * - Vercel Hobby 60초 maxDuration
 * - Finnhub 무료 60 req/min → 직렬 + 1.1초 sleep
 * - 60초 / 1.1초 = 약 50건/cron
 *
 * 등록: vercel.json crons "schedule": "10 * * * *" (매시 10분, 분산)
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
// Hobby 60s 한계 + Finnhub 60/min + HTTP latency 안전 마진
// 40건 × 1.2초(sleep + fetch latency 평균) ≈ 48초 → 60초 안에 안전
const BATCH_SIZE = 40;
const SLEEP_MS = 1000;

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

interface Profile2Response {
  marketCapitalization?: number;  // 단위: 백만 USD (M)
  ipo?: string;                   // YYYY-MM-DD
  finnhubIndustry?: string;
  name?: string;
}

async function fetchProfile(symbol: string, apiKey: string): Promise<Profile2Response | null> {
  try {
    const r = await fetch(
      `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getAdmin();

  // 1. 미수집 종목 50건 (오래된 것 우선 — 시총 큰 종목이 보통 오래된 종목이라 유리)
  //    한국 거래소는 Finnhub 미지원이라 스킵
  const { data: pending, error: selErr } = await supabase
    .from('stock_listings')
    .select('symbol, exchange')
    .is('market_cap', null)
    .in('status', ['watch', 'eligible'])
    .eq('exchange', 'US')   // KS/KQ 는 별도 우회 (수동 추가)
    .order('first_seen', { ascending: true })
    .limit(BATCH_SIZE);

  if (selErr) {
    console.error('[enrich-listings] select error:', selErr);
    return NextResponse.json({ error: 'db select failed' }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, message: 'no pending listings to enrich' });
  }

  let processed = 0;
  let errors = 0;
  const sample: string[] = [];

  for (const row of pending) {
    const profile = await fetchProfile(row.symbol, apiKey);
    if (profile && (profile.marketCapitalization || profile.ipo)) {
      const marketCap = profile.marketCapitalization
        ? Math.round(profile.marketCapitalization * 1_000_000)
        : null;
      const listedAt = profile.ipo || null;

      // description 보강도 함께 (기존 빈 경우)
      const update: Record<string, unknown> = {};
      if (marketCap !== null) update.market_cap = marketCap;
      if (listedAt) update.listed_at = listedAt;

      const { error: updErr } = await supabase
        .from('stock_listings')
        .update(update)
        .eq('symbol', row.symbol);

      if (!updErr) {
        processed++;
        if (sample.length < 5) sample.push(row.symbol);
      } else {
        errors++;
      }
    } else {
      // profile 비어있어도 카운트 (Finnhub이 일부 종목 metadata 없음)
      // last_seen만 갱신해서 다음 cron에서 또 시도하지 않게 마킹할 수도 있으나
      // 일단 무한 재시도는 그대로 두고 후속 검토
    }
    // Rate limit 안전 영역 (Finnhub 무료 60/min)
    await new Promise(res => setTimeout(res, SLEEP_MS));
  }

  return NextResponse.json({
    ok: true,
    requested: pending.length,
    processed,
    errors,
    sample,
  });
}
