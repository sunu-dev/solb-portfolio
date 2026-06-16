import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyAssetClass } from '@/utils/leverageGuard';

/**
 * 종목별 즉시 enrich admin API — Finnhub /stock/profile2로 시총·상장일 채움
 *
 * POST /api/admin/listings/enrich — { symbol }
 *
 * 용도: cron이 다 채우기 전 운영자가 관심 종목 우선 채움.
 *       한국 거래소 종목은 Finnhub 미지원이라 별도 처리.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

async function verifyAdmin(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
  if (!isAdmin) return { ok: false, res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { ok: true, userId: user.id };
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.res;

  const { symbol } = await req.json() as { symbol?: string };
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 });
  }

  try {
    const r = await fetch(
      `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) {
      return NextResponse.json({ error: `Finnhub ${r.status}` }, { status: 502 });
    }
    const profile = await r.json() as {
      marketCapitalization?: number;
      ipo?: string;
      finnhubIndustry?: string;
      name?: string;
    };

    const marketCap = profile.marketCapitalization
      ? Math.round(profile.marketCapitalization * 1_000_000)
      : null;
    const listedAt = profile.ipo || null;

    if (marketCap === null && !listedAt) {
      return NextResponse.json({
        error: 'Finnhub에 metadata 없음 (한국 거래소는 미지원, 수동 입력 권장)',
        profile,
      }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (marketCap !== null) update.market_cap = marketCap;
    if (listedAt) update.listed_at = listedAt;

    // 자산 클래스 동기화 (cron enrich-listings와 동일 SSOT) — admin이 market_cap을 먼저 채우면
    // cron 큐(market_cap IS NULL)에서 빠져 asset_class 분류가 영영 누락되던 갭 해소.
    const assetClass = classifyAssetClass(symbol, profile.name);
    update.asset_class = assetClass;
    if (assetClass === 'leveraged_single' || assetClass === 'inverse_single') {
      update.status = 'rejected';
    }

    const { data, error } = await supabaseAdmin
      .from('stock_listings')
      .update(update)
      .eq('symbol', symbol)
      .select()
      .single();

    if (error) {
      console.error('[admin/listings/enrich] db error:', error);
      return NextResponse.json({ error: 'db error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      listing: data,
      profile: { name: profile.name, industry: profile.finnhubIndustry },
    });
  } catch (e) {
    console.error('[admin/listings/enrich] error:', e);
    return NextResponse.json({ error: 'enrich failed' }, { status: 500 });
  }
}
