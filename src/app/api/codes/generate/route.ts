import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['sunu.develop@gmail.com'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외 (0,O,I,1)
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${part1}${part2}`;
}

// POST /api/codes/generate — 관리자 코드 발급
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
    if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const {
      type = 'invite',
      count = 1,
      max_uses = 1,
      expires_at = null,
      rewards = {},
      description = '',
    } = await req.json() as {
      type?: string;
      count?: number;
      max_uses?: number;
      expires_at?: string | null;
      rewards?: Record<string, unknown>;
      description?: string;
    };

    const prefix = {
      invite: 'SOLB',
      referral: 'REF',
      discount: 'DISC',
      promo: 'PROMO',
    }[type] ?? 'SOLB';

    // 중복 없는 코드 생성
    const generated: string[] = [];
    let attempts = 0;
    while (generated.length < Math.min(count, 100) && attempts < 200) {
      attempts++;
      const code = generateCode(prefix);
      if (!generated.includes(code)) {
        // DB 중복 확인
        const { data } = await supabaseAdmin.from('codes').select('id').eq('code', code).single();
        if (!data) generated.push(code);
      }
    }

    const rows = generated.map(code => ({
      code,
      type,
      created_by: null, // 관리자 직접 생성
      max_uses,
      expires_at: expires_at || null,
      rewards,
      description,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from('codes')
      .insert(rows)
      .select('code, type, max_uses, expires_at, created_at');

    if (error) throw error;

    return NextResponse.json({ success: true, codes: inserted });
  } catch (e) {
    console.error('Code generate error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// GET /api/codes/generate — 코드 목록 조회 (관리자)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
    if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const type = req.nextUrl.searchParams.get('type');

    let query = supabaseAdmin
      .from('codes')
      .select('*, code_uses(used_by, used_at, context)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ codes: data });
  } catch (e) {
    console.error('Code list error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// PATCH /api/codes/generate — 코드 활성화/비활성화
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
    if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const { code, is_active } = await req.json() as { code: string; is_active: boolean };

    const { error } = await supabaseAdmin
      .from('codes')
      .update({ is_active })
      .eq('code', code);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Code patch error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
