import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 한국 종목 (또는 임의 종목) 수동 추가 admin API
 *
 * POST /api/admin/listings/add — { symbol, exchange, description?, kr_name? }
 *
 * 용도: Finnhub이 한국 거래소(KS·KQ)를 미지원하는 무료 티어 한계 우회.
 *       운영자가 신규 한국 IPO를 수동 등록.
 */

export const runtime = 'nodejs';

const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];
const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const VALID_EXCHANGES = ['US', 'KS', 'KQ'] as const;

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

  const body = await req.json() as {
    symbol?: string;
    exchange?: string;
    description?: string;
    kr_name?: string;
    listed_at?: string;
    market_cap?: number;
    status?: string;
  };

  if (!body.symbol || !body.exchange) {
    return NextResponse.json({ error: 'symbol and exchange required' }, { status: 400 });
  }
  if (!VALID_EXCHANGES.includes(body.exchange as typeof VALID_EXCHANGES[number])) {
    return NextResponse.json({ error: `invalid exchange — must be one of ${VALID_EXCHANGES.join('|')}` }, { status: 400 });
  }

  // Symbol 정규화 — 한국은 ".KS" / ".KQ" suffix 강제 (Finnhub/Yahoo 호환)
  let normalized = body.symbol.toUpperCase().trim();
  if (body.exchange === 'KS' && !normalized.endsWith('.KS')) {
    normalized = normalized.replace(/\.[A-Z]+$/, '') + '.KS';
  } else if (body.exchange === 'KQ' && !normalized.endsWith('.KQ')) {
    normalized = normalized.replace(/\.[A-Z]+$/, '') + '.KQ';
  }

  const row = {
    symbol: normalized,
    exchange: body.exchange,
    description: body.description?.trim() || null,
    kr_name: body.kr_name?.trim() || null,
    listed_at: body.listed_at || null,
    market_cap: body.market_cap || null,
    status: body.status && ['watch', 'eligible', 'universe', 'rejected'].includes(body.status) ? body.status : 'eligible',
    reviewed_at: new Date().toISOString(),
    reviewed_by: auth.userId,
  };

  const { data, error } = await supabaseAdmin
    .from('stock_listings')
    .upsert(row, { onConflict: 'symbol' })
    .select()
    .single();

  if (error) {
    console.error('[admin/listings/add] error:', error);
    return NextResponse.json({ error: 'db error: ' + error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, listing: data });
}
