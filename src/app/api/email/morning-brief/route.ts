/**
 * 모닝브리프 이메일 구독 토글
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * POST   /api/email/morning-brief — 구독 ON
 * DELETE /api/email/morning-brief — 구독 OFF
 *
 * 인증: Bearer token (auth.users.id 추출).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await getSupabase().auth.getUser(token);
    return user?.id ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from('email_subscriptions')
    .upsert(
      { user_id: userId, morning_brief_enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[email/morning-brief] subscribe', error);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from('email_subscriptions')
    .upsert(
      { user_id: userId, morning_brief_enabled: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { data } = await supabase
    .from('email_subscriptions')
    .select('morning_brief_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({ enabled: data?.morning_brief_enabled ?? false });
}
