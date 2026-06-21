import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIp } from '@/lib/rateLimiter';
import { TOUR_EVENT_SET } from '@/lib/tourEvents';

/**
 * /api/tour-event — 게스트(비로그인) 투어/활성화 텔레메트리 sink.
 *
 * logApiCall은 비로그인 early-return이라 게스트 funnel이 미관측 → 이 no-auth 엔드포인트가 메움.
 *
 * 방어:
 * - rate-limit은 service-role 클라이언트로 api_calls를 직접 count (RLS·anon-client 의존 제거).
 *   조회 실패 시 fail-CLOSED(거부) — 공개 엔드포인트라 fail-open 금지(프로젝트 RLS anon 안티패턴 회피).
 * - 이벤트 화이트리스트(tourEvents.ts) + anonId 길이 + sanitizeMeta(허용키·64자 cap).
 * - tour_events는 RLS service-role 전용(2026-06-21_tour_events.sql) — 클라 직접 쓰기 불가, 이 라우트만 insert.
 * - anonId는 클라 생성·미검증 → 지표는 best-effort(distinctGuests 위조 가능, go/no-go 단독 사용 금지).
 *
 * ⚠️ 배포 순서: 마이그레이션(tour_events)을 이 라우트 배포 전에 적용. 미적용 시 insert가 500(클라는 silent).
 *   보존: cleanup-pii cron이 30일 TTL 집행.
 */

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
})();

const ENDPOINT = '/api/tour-event';
const WINDOW_MS = 60_000;
const MAX_PER_MIN = 30; // IP당. 정상 세션 ~6-10건이라 충분, 폭주는 throttle. (IP 회전 대비는 WAF 권장)

// meta는 허용 키만 보존 + 값 정제 (payload bloat·prototype pollution·임의 주입 방지)
const META_KEYS = ['featureId', 'step', 'anchor', 'from', 'chapter'];
function sanitizeMeta(raw: unknown): Record<string, string | number> {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const k of META_KEYS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v) out[k] = v.slice(0, 64);
  }
  return out;
}

/** service-role count — RLS 우회로 신뢰 가능. 실패 시 fail-CLOSED(false). */
async function rateOk(ip: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error } = await supabaseAdmin
      .from('api_calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_key', `ip:${ip}`)
      .eq('endpoint', ENDPOINT)
      .gte('created_at', sinceIso);
    if (error) return false; // fail-closed
    return (count || 0) < MAX_PER_MIN;
  } catch {
    return false; // fail-closed
  }
}

/** rate-limit 회계 + 관측 (api_calls). 무효 요청도 기록해 throttle 윈도우에 포함. */
async function record(ip: string, status: number, errorCode?: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('api_calls').insert({
      endpoint: ENDPOINT,
      user_key: `ip:${ip}`,
      user_id: null,
      ip,
      status,
      latency_ms: 0,
      error_code: errorCode || null,
    });
  } catch { /* silent */ }
}

interface TourEventBody {
  event?: string;
  anonId?: string;
  meta?: unknown;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const ip = getClientIp(req);

  // rate-limit (service-role count, fail-closed)
  if (!(await rateOk(ip))) {
    await record(ip, 429, 'rate_limit');
    return NextResponse.json({ ok: false, code: 'rate_limit' }, { status: 429 });
  }

  let body: TourEventBody;
  try {
    body = (await req.json()) as TourEventBody;
  } catch {
    await record(ip, 400, 'parse_failed');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = typeof body.event === 'string' ? body.event : '';
  const anonId = typeof body.anonId === 'string' ? body.anonId.slice(0, 64) : '';

  // 이벤트 화이트리스트 + anonId 최소 형식
  if (!TOUR_EVENT_SET.has(event) || anonId.length < 8) {
    await record(ip, 400, 'invalid_event');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 인증 사용자면 user_id 추출(선택). 대부분 게스트라 null. 위조 토큰은 무시되어 guest 처리.
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id ?? null;
    } catch { /* guest */ }
  }

  try {
    const { error } = await supabaseAdmin.from('tour_events').insert({
      anon_id: anonId,
      user_id: userId,
      event,
      auth_state: userId ? 'user' : 'guest',
      meta: sanitizeMeta(body.meta),
    });
    if (error) {
      console.error('[tour-event] insert failed:', error.message);
      await record(ip, 500, 'db_error');
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } catch (e) {
    console.error('[tour-event] error:', e);
    await record(ip, 500, 'db_error');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  await record(ip, 204);
  return new NextResponse(null, { status: 204 });
}
