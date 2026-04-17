import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const FOUNDER_EMAILS = ['sunu.develop@gmail.com'];
const DEFAULT_MAX_USES = 3;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SOLB-${part1}${part2}`;
}

// GET — 내 초대 코드 조회 (없으면 자동 생성)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const isFounder = FOUNDER_EMAILS.includes(user.email || '');
  const maxUses = isFounder ? null : DEFAULT_MAX_USES;

  // 기존 코드 조회
  const { data: existing } = await supabaseAdmin
    .from('codes')
    .select('*, code_uses(used_by, used_at)')
    .eq('created_by', user.id)
    .eq('type', 'invite')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({
      code: existing.code,
      use_count: existing.use_count,
      max_uses: existing.max_uses,
      is_founder: isFounder,
      uses: existing.code_uses || [],
    });
  }

  // 없으면 생성 (중복 없는 코드 찾기)
  let code = '';
  for (let i = 0; i < 10; i++) {
    const candidate = generateCode();
    const { data } = await supabaseAdmin.from('codes').select('id').eq('code', candidate).single();
    if (!data) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: 'code generation failed' }, { status: 500 });

  const { data: created, error: createError } = await supabaseAdmin
    .from('codes')
    .insert({
      code,
      type: 'invite',
      created_by: user.id,
      max_uses: maxUses,
      rewards: {},
      description: `${user.email} 개인 초대 코드`,
    })
    .select()
    .single();

  if (createError || !created) return NextResponse.json({ error: 'failed to create code' }, { status: 500 });

  return NextResponse.json({
    code: created.code,
    use_count: 0,
    max_uses: maxUses,
    is_founder: isFounder,
    uses: [],
  });
}
