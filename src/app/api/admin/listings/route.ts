import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callAiJson } from '@/lib/aiProvider';
import { isSingleStockLeverage } from '@/utils/leverageGuard';

/**
 * 신규 상장 종목 검수 admin API
 *
 * GET   /api/admin/listings?status=watch&exchange=US&limit=100 — 목록 조회
 * PATCH /api/admin/listings — { symbol, status?, kr_name?, notes? } 부분 업데이트
 * POST  /api/admin/listings/generate-kr — { symbol } → Gemini로 한국어명 생성
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

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

// ─── GET: 목록 조회 ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.res;

  const params = req.nextUrl.searchParams;
  const status = params.get('status') || 'watch';
  const exchange = params.get('exchange');
  const search = params.get('q')?.trim();
  const limit = Math.min(parseInt(params.get('limit') || '100'), 500);

  let query = supabaseAdmin
    .from('stock_listings')
    .select('symbol, exchange, description, kr_name, listed_at, market_cap, status, first_seen, last_seen, reviewed_at, notes')
    .eq('status', status)
    .order('first_seen', { ascending: false })
    .limit(limit);

  if (exchange) query = query.eq('exchange', exchange);
  if (search) query = query.or(`symbol.ilike.%${search}%,description.ilike.%${search}%,kr_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) {
    console.error('[admin/listings GET] error:', error);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  // 상태별 카운트 (UI 칩에 표시용)
  const { data: counts } = await supabaseAdmin
    .from('stock_listings')
    .select('status', { count: 'exact', head: false });
  const countsByStatus: Record<string, number> = {};
  if (counts) {
    for (const row of counts) {
      const s = (row as { status: string }).status;
      countsByStatus[s] = (countsByStatus[s] || 0) + 1;
    }
  }

  return NextResponse.json({
    listings: data || [],
    countsByStatus,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ─── PATCH: 상태/메타 업데이트 ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.res;

  const body = await req.json() as {
    symbol?: string;
    status?: 'watch' | 'eligible' | 'universe' | 'rejected' | 'delisted';
    kr_name?: string;
    notes?: string;
  };

  if (!body.symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  // 단일종목 레버리지는 eligible/universe(신규 발굴 표면)로 승급 금지 — add/route.ts·enrich-listings와 일관.
  // PATCH가 유일하게 빠져 있던 방어선 (재감사 should-fix). symbol-aware(US·deny) + kr_name 키워드.
  if ((body.status === 'eligible' || body.status === 'universe')
      && isSingleStockLeverage(body.symbol, body.kr_name)) {
    return NextResponse.json(
      { error: '단일종목 레버리지·인버스는 universe 편입 대상이 아니에요', code: 'leverage_blocked' },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { reviewed_at: new Date().toISOString(), reviewed_by: auth.userId };
  if (body.status !== undefined) update.status = body.status;
  if (body.kr_name !== undefined) update.kr_name = body.kr_name;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabaseAdmin
    .from('stock_listings')
    .update(update)
    .eq('symbol', body.symbol)
    .select()
    .single();

  if (error) {
    console.error('[admin/listings PATCH] error:', error);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, listing: data });
}

// ─── POST: Gemini로 한국어명 생성 ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.res;

  const body = await req.json() as { symbol?: string };
  if (!body.symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from('stock_listings')
    .select('symbol, exchange, description')
    .eq('symbol', body.symbol)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'listing not found' }, { status: 404 });
  }

  const prompt = `다음 미국·한국 상장 종목의 한국어 표기를 결정해주세요.

종목: ${row.symbol} (거래소: ${row.exchange})
영문 설명: ${row.description || '(없음)'}

규칙:
- 일반 기업이면 한국 경제 미디어(한경, 매경, 연합)에서 쓰는 표기 사용 (예: NVIDIA→엔비디아, Tesla→테슬라)
- 글로벌 ETF (운용사 SPDR/iShares/Vanguard 등)는 영문 유지 (예: SPY, QQQ)
- 한국 ETF는 한국어 운용사명 (예: KODEX 200, TIGER 미국나스닥100)
- 한국 종목(.KS, .KQ)은 한국 정식명 (예: 005930.KS → 삼성전자)
- 확실하지 않으면 is_confident=false

JSON으로만 응답:
{ "kr_name": "한국어 표기", "is_etf": true/false, "is_confident": true/false }`;

  try {
    const aiRes = await callAiJson({ prompt, temperature: 0.1, maxTokens: 200 });
    const parsed = JSON.parse(aiRes.text) as { kr_name: string; is_etf: boolean; is_confident: boolean };
    return NextResponse.json({ ok: true, ...parsed, provider: aiRes.provider });
  } catch (e) {
    console.error('[admin/listings POST] Gemini error:', e);
    return NextResponse.json({ error: 'Gemini 호출 실패' }, { status: 503 });
  }
}
