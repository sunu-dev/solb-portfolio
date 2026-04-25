import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PII 보존 정책 cleanup cron — L1 정합성 결함 대응.
 *
 * 정책:
 * - ai_usage.ip   → 90일 후 NULL로 익명화 (분석 데이터는 유지)
 * - api_calls.ip  → 30일 후 NULL로 익명화 (관측성 위주, IP 가치 낮음)
 * - 365일+ 이전 행 hard DELETE (저장 비용 + GDPR/개보법)
 *
 * 인증: Vercel Cron이 자동 설정하는 Authorization: Bearer ${CRON_SECRET}.
 *      외부에서 임의 호출 차단.
 *
 * 등록: vercel.json crons에 매주 일요일 4am KST = 토 19:00 UTC.
 *       cron expression: "0 19 * * 6"
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 보안: secret 미설정 시 외부 호출 차단 (Vercel은 자동 설정)
    return false;
  }
  return auth === `Bearer ${secret}`;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } },
  );
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = {
    ai_usage_anonymized: 0,
    api_calls_anonymized: 0,
    ai_usage_deleted: 0,
    api_calls_deleted: 0,
    errors: [] as string[],
  };

  const supabase = getAdmin();

  try {
    // 1. ai_usage IP 익명화 (90일+) — count 옵션은 update/delete 두 번째 인자
    const { count: aiAnon, error: aiAnonErr } = await supabase
      .from('ai_usage')
      .update({ ip: null }, { count: 'exact' })
      .lt('created_at', daysAgoIso(90))
      .not('ip', 'is', null);
    if (aiAnonErr) stats.errors.push(`ai_usage anon: ${aiAnonErr.message}`);
    else stats.ai_usage_anonymized = aiAnon || 0;

    // 2. api_calls IP 익명화 (30일+)
    const { count: apiAnon, error: apiAnonErr } = await supabase
      .from('api_calls')
      .update({ ip: null }, { count: 'exact' })
      .lt('created_at', daysAgoIso(30))
      .not('ip', 'is', null);
    if (apiAnonErr) stats.errors.push(`api_calls anon: ${apiAnonErr.message}`);
    else stats.api_calls_anonymized = apiAnon || 0;

    // 3. 365일+ hard DELETE — ai_usage
    const { count: aiDel, error: aiDelErr } = await supabase
      .from('ai_usage')
      .delete({ count: 'exact' })
      .lt('created_at', daysAgoIso(365));
    if (aiDelErr) stats.errors.push(`ai_usage delete: ${aiDelErr.message}`);
    else stats.ai_usage_deleted = aiDel || 0;

    // 4. 365일+ hard DELETE — api_calls
    const { count: apiDel, error: apiDelErr } = await supabase
      .from('api_calls')
      .delete({ count: 'exact' })
      .lt('created_at', daysAgoIso(365));
    if (apiDelErr) stats.errors.push(`api_calls delete: ${apiDelErr.message}`);
    else stats.api_calls_deleted = apiDel || 0;

    return NextResponse.json({
      ok: stats.errors.length === 0,
      ranAt: new Date().toISOString(),
      ...stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
