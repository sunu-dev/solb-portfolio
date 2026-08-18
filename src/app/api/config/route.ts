import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * 공개 노출을 허용한 설정 키 화이트리스트.
 *
 * app_config는 service-role로 읽기 때문에 RLS가 걸리지 않는다. 전 행을 그대로 반환하면
 * 앞으로 추가되는 운영 키(내부 플래그·임계값·외부 식별자)가 자동으로 공개된다.
 * 클라이언트 부팅에 실제로 필요한 키만 여기 등재하고, 나머지는 관리자 토큰이 있을 때만 준다.
 */
const PUBLIC_CONFIG_KEYS = new Set(['service_mode', 'invite_required']);

async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;
  return ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
}

// GET /api/config — 공개 키만 반환. 관리자 토큰이 있으면 전체 반환.
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value, description, updated_at');

    if (error) throw error;

    const admin = await isAdminRequest(req);
    const config: Record<string, string> = {};
    (data || []).forEach(row => {
      if (admin || PUBLIC_CONFIG_KEYS.has(row.key)) config[row.key] = row.value;
    });

    // 관리자 응답은 사용자별이라 공유 캐시 금지.
    return NextResponse.json({ config }, {
      headers: {
        'Cache-Control': admin
          ? 'private, no-store'
          : 's-maxage=30, stale-while-revalidate=60',
      },
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

    // 변경 전 값을 upsert보다 **먼저** 읽는다.
    // 뒤에 읽으면 old_value가 이미 새 값이 되어 감사 로그의 증거력이 사라진다.
    const oldConfig = await supabaseAdmin.from('app_config').select('key, value').in('key', Object.keys(updates));
    const oldMap: Record<string, string> = {};
    (oldConfig.data || []).forEach(r => { oldMap[r.key] = r.value; });

    // upsert 각 키
    const { error } = await supabaseAdmin
      .from('app_config')
      .upsert(rows, { onConflict: 'key' });

    if (error) throw error;

    // 감사 로그 (변경 이력)
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
