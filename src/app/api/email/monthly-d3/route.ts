/**
 * 월말 D-3 이메일 구독 토글
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * GET    — 현재 구독 상태 조회
 * POST   — 구독 ON
 * DELETE — 구독 OFF
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

async function setEnabled(userId: string, enabled: boolean) {
  return getSupabase()
    .from('email_subscriptions')
    .upsert(
      { user_id: userId, monthly_d3_enabled: enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await setEnabled(userId, true);
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await setEnabled(userId, false);
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data } = await getSupabase()
    .from('email_subscriptions')
    .select('monthly_d3_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  return NextResponse.json({ enabled: data?.monthly_d3_enabled ?? false });
}
