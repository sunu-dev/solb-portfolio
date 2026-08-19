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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || '';
  if (!url || !anonKey || !serviceKey) return null;

  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

async function getUserId(
  req: NextRequest,
  authClient: SupabaseClient,
): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await authClient.auth.getUser(token);
    return user?.id ?? null;
  } catch { return null; }
}

async function setEnabled(
  adminClient: SupabaseClient,
  userId: string,
  enabled: boolean,
) {
  return adminClient
    .from('email_subscriptions')
    .upsert(
      { user_id: userId, monthly_d3_enabled: enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}

export async function POST(req: NextRequest) {
  if (!req.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const clients = getClients();
  if (!clients) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const userId = await getUserId(req, clients.auth);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await setEnabled(clients.admin, userId, true);
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!req.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const clients = getClients();
  if (!clients) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const userId = await getUserId(req, clients.auth);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await setEnabled(clients.admin, userId, false);
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  if (!req.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const clients = getClients();
  if (!clients) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const userId = await getUserId(req, clients.auth);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await clients.admin
    .from('email_subscriptions')
    .select('monthly_d3_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 });
  return NextResponse.json({ enabled: data?.monthly_d3_enabled ?? false });
}
