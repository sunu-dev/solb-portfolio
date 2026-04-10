import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.json() as { subscription: PushSubscription; token?: string };
  const { subscription, token } = body;

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }

  // 로그인 유저 확인
  let userId: string | null = null;
  if (token) {
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    } catch { /* not logged in */ }
  }

  if (!userId) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, subscription, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    console.error('[push/subscribe]', error);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
