import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyAssetClass, isUniverseEligibleClass } from '@/utils/leverageGuard';

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

// Universe 편입 3중 AND 조건 (docs/THRESHOLDS.md §8, ALGORITHM_REVIEW.md §4-#1)
const UNIVERSE_MIN_MARKET_CAP = 5_000_000_000;  // $5B
const UNIVERSE_MIN_LISTING_MONTHS = 12;          // 상장 12개월 이상
// Finnhub이 marketCapitalization을 영영 안 주는 종목이 큐를 영구 점유(HOL)하지 못하도록 상한.
// (2026-06-16_stock_listings_enrich_cursor.sql — last_enrich_at·enrich_attempts 선행 적용 필요)
const MAX_ENRICH_ATTEMPTS = 6;

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
    .select('symbol, exchange, enrich_attempts')
    .is('market_cap', null)
    .in('status', ['watch', 'eligible'])
    .eq('exchange', 'US')   // KS/KQ 는 별도 우회 (수동 추가)
    .lt('enrich_attempts', MAX_ENRICH_ATTEMPTS)  // 영구 stuck 종목 제외 (HOL 차단)
    .order('last_enrich_at', { ascending: true, nullsFirst: true })  // 미시도 우선 → 오래된 시도 순
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
  let autoEligible = 0;          // 3중 AND 자동 승급 카운트
  const sample: string[] = [];
  const eligibleSample: string[] = [];

  for (const row of pending) {
    const profile = await fetchProfile(row.symbol, apiKey);
    if (profile && (profile.marketCapitalization || profile.ipo)) {
      const marketCap = profile.marketCapitalization
        ? Math.round(profile.marketCapitalization * 1_000_000)
        : null;
      const listedAt = profile.ipo || null;

      const update: Record<string, unknown> = {
        last_enrich_at: new Date().toISOString(),
        enrich_attempts: (row.enrich_attempts ?? 0) + 1,
      };
      if (marketCap !== null) update.market_cap = marketCap;
      if (listedAt) update.listed_at = listedAt;

      // 자산 클래스 자동 분류 (P1, 2026-05-28) — leverageGuard SSOT
      // Universe 4번째 룰 + 단일종목 레버리지/인버스·ETN·other 자동 배제
      const assetClass = classifyAssetClass(row.symbol, profile.name);
      update.asset_class = assetClass;
      // 단일종목 레버리지·인버스는 universe 진입 자체 차단 → status='rejected'
      if (assetClass === 'leveraged_single' || assetClass === 'inverse_single') {
        update.status = 'rejected';
      }

      // Universe 편입 4중 AND 자동 검증 (THRESHOLDS.md #41-43, #46)
      // - market_cap >= $5B
      // - 상장 12개월 이상 (ipo + 12개월 < 오늘)
      // - 데이터 정상 (marketCap AND listedAt 둘 다 있음)
      // - 자산 클래스 허용 (normal·etf_index·etf_sector·etf_dividend·reit만)
      const meetsUniverse =
        marketCap !== null &&
        marketCap >= UNIVERSE_MIN_MARKET_CAP &&
        listedAt !== null &&
        isUniverseEligibleClass(assetClass) &&
        (() => {
          const ipoDate = new Date(listedAt);
          if (isNaN(ipoDate.getTime())) return false;
          const monthsSince = (Date.now() - ipoDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          return monthsSince >= UNIVERSE_MIN_LISTING_MONTHS;
        })();
      if (meetsUniverse) {
        update.status = 'eligible';
      }

      const { error: updErr } = await supabase
        .from('stock_listings')
        .update(update)
        .eq('symbol', row.symbol);

      if (!updErr) {
        processed++;
        if (sample.length < 5) sample.push(row.symbol);
        if (meetsUniverse) {
          autoEligible++;
          if (eligibleSample.length < 5) eligibleSample.push(row.symbol);
        }
      } else {
        errors++;
      }
    } else {
      // profile 비어있음 — 커서 전진 + 재시도 카운트 증가(영구 stuck HOL 차단).
      // MAX_ENRICH_ATTEMPTS 초과 시 다음 select에서 제외돼 새 종목이 큐에 진입할 수 있다.
      await supabase
        .from('stock_listings')
        .update({ last_enrich_at: new Date().toISOString(), enrich_attempts: (row.enrich_attempts ?? 0) + 1 })
        .eq('symbol', row.symbol);
    }
    await new Promise(res => setTimeout(res, SLEEP_MS));
  }

  return NextResponse.json({
    ok: true,
    autoEligible,
    eligibleSample,
    requested: pending.length,
    processed,
    errors,
    sample,
  });
}
