import { NextRequest, NextResponse } from 'next/server';
import { requireAuthClient } from '@/lib/supabaseServer';

// 모듈 스코프에서 클라이언트를 만들면 키가 없을 때 **빌드 전체가 실패**한다
// (Next가 page data 수집 중 이 모듈을 import한다). 요청 시점 지연 생성으로 국소화.
//
// ⚠️ 별건 미해결: 이 라우트는 토큰으로 사용자를 확인한 뒤 실제 upsert/delete를
// **anon 클라이언트**로 수행한다. push_subscriptions의 RLS가 auth.uid() 기반이면 저장이
// 거부되고, permissive면 보안 모델이 약해진다. 감사 후속 항목으로 등재돼 있다.
const supabase = () => requireAuthClient();

/**
 * 클라이언트 획득을 **try 밖에서** 먼저 한다.
 *
 * 지연 생성으로 바꾸면서 `supabase()` 자체가 던질 수 있게 됐는데, 아래 핸들러들의
 * `catch { /* not logged in *\/ }`는 '토큰 무효'를 삼키려고 만든 것이라
 * **설정 오류(anon 키 누락)까지 같이 삼켜** 401 '로그인이 필요해요'로 위장했다.
 * 모듈 스코프 시절엔 빌드 실패로 즉시 드러나던 것이라 이 오분류는 지연 전환이 만든 회귀다.
 * 설정 오류는 503으로, 토큰 검증 실패만 401로 남긴다.
 */
function acquireClient(): { ok: true; db: ReturnType<typeof requireAuthClient> } | { ok: false; res: NextResponse } {
  try {
    return { ok: true, db: supabase() };
  } catch (e) {
    console.error('[push/subscribe] Supabase 클라이언트 사용 불가 — 환경변수 확인 필요', e);
    return { ok: false, res: NextResponse.json({ error: 'storage unavailable' }, { status: 503 }) };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { subscription: PushSubscription; token?: string };
  const { subscription, token } = body;

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }

  const acquired = acquireClient();
  if (!acquired.ok) return acquired.res;
  const db = acquired.db;

  // 로그인 유저 확인 — 여기 catch는 '토큰 무효'만 삼킨다.
  let userId: string | null = null;
  if (token) {
    try {
      const { data: { user } } = await db.auth.getUser(token);
      userId = user?.id ?? null;
    } catch { /* not logged in */ }
  }

  if (!userId) {
    return NextResponse.json({ error: 'login required' }, { status: 401 });
  }

  const { error } = await db
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

  const acquired = acquireClient();
  if (!acquired.ok) return acquired.res;
  const db = acquired.db;

  try {
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    await db.from('push_subscriptions').delete().eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[push/subscribe] DELETE 실패', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
