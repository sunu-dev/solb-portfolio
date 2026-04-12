import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['sunu.develop@gmail.com'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/config — 전체 설정 조회 (공개)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value, description, updated_at');

    if (error) throw error;

    const config: Record<string, string> = {};
    (data || []).forEach(row => { config[row.key] = row.value; });

    return NextResponse.json({ config }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    });
  } catch (e) {
    console.error('Config GET error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// POST /api/config — 설정 변경 (관리자 전용)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // 토큰으로 유저 확인
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
    if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const { updates } = await req.json() as { updates: Record<string, string> };
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates required' }, { status: 400 });
    }

    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value: String(value),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }));

    // upsert 각 키
    const { error } = await supabaseAdmin
      .from('app_config')
      .upsert(rows, { onConflict: 'key' });

    if (error) throw error;

    // 감사 로그 (변경 이력)
    const oldConfig = await supabaseAdmin.from('app_config').select('key, value').in('key', Object.keys(updates));
    const oldMap: Record<string, string> = {};
    (oldConfig.data || []).forEach(r => { oldMap[r.key] = r.value; });

    await supabaseAdmin.from('config_audit_log').insert(
      Object.entries(updates).map(([key, value]) => ({
        changed_by: user.id,
        key,
        old_value: oldMap[key] ?? null,
        new_value: String(value),
      }))
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Config POST error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
