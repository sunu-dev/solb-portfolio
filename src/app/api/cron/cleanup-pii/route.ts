import { NextResponse } from 'next/server';
import { requireServiceClient } from '@/lib/supabaseServer';
import { defineRoute } from '@/lib/apiRoute';

/**
 * PII 보존 정책 cleanup cron — L1 정합성 결함 대응.
 *
 * 정책:
 * - ai_usage.ip   → 90일 후 NULL로 익명화 (분석 데이터는 유지)
 * - api_calls.ip  → 30일 후 NULL로 익명화 (관측성 위주, IP 가치 낮음)
 * - 365일+ 이전 행 hard DELETE (저장 비용 + GDPR/개보법)
 * - alert_log    → 365일+ 행 hard DELETE (정책 SSOT: docs/NOTIFICATION_POLICY.md §4.4)
 * - tour_events  → 30일+ 행 hard DELETE (게스트 텔레메트리 보존 — 2026-06-21_tour_events.sql)
 *
 * 인증: Vercel Cron이 자동 설정하는 Authorization: Bearer ${CRON_SECRET}.
 *      외부에서 임의 호출 차단.
 *
 * 등록: vercel.json crons에 매주 일요일 4am KST = 토 19:00 UTC.
 *       cron expression: "0 19 * * 6"
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

// 키 해석은 `@/lib/supabaseServer` 한 곳이 SSOT다.
// 예전엔 여기서 `SUPABASE_SERVICE_KEY` **단독**으로 읽었다 — 비-cron 라우트는 전부
// `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_KEY` 폴백을 갖고 있었기 때문에,
// 새 이름만 설정한 환경에서 **웹은 멀쩡하고 cron만 죽는** 부분 장애가 났다
// (알림·이메일 미발송은 사용자가 신고하기 전엔 드러나지 않는다).
function getAdmin() {
  return requireServiceClient();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400 * 1000).toISOString();
}

export const GET = defineRoute({
  name: '/api/cron/cleanup-pii',
  auth: 'cron',
  rateLimit: false,
  handler: async () => {

  const stats = {
    ai_usage_anonymized: 0,
    api_calls_anonymized: 0,
    ai_usage_deleted: 0,
    api_calls_deleted: 0,
    alert_log_deleted: 0,
    tour_events_deleted: 0,
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

    // 5. 365일+ hard DELETE — alert_log (정책 §4.4 — 컴플라이언스 분쟁 보관기간 만료)
    const { count: logDel, error: logDelErr } = await supabase
      .from('alert_log')
      .delete({ count: 'exact' })
      .lt('sent_at', daysAgoIso(365));
    // 테이블 미존재 시 silent — 마이그레이션 미적용 환경 대응
    if (logDelErr && !/relation .* does not exist/i.test(logDelErr.message)) {
      stats.errors.push(`alert_log delete: ${logDelErr.message}`);
    } else {
      stats.alert_log_deleted = logDel || 0;
    }

    // 6. tour_events 30일+ hard DELETE — 게스트 텔레메트리 보존 정책(2026-06-21_tour_events.sql 주석을 실집행)
    const { count: tourDel, error: tourDelErr } = await supabase
      .from('tour_events')
      .delete({ count: 'exact' })
      .lt('created_at', daysAgoIso(30));
    if (tourDelErr && !/relation .* does not exist/i.test(tourDelErr.message)) {
      stats.errors.push(`tour_events delete: ${tourDelErr.message}`);
    } else {
      stats.tour_events_deleted = tourDel || 0;
    }

    return NextResponse.json({
      ok: stats.errors.length === 0,
      ranAt: new Date().toISOString(),
      ...stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
},
});
