import { NextRequest, NextResponse } from 'next/server';
import { isAdminIdentity, resolveUserOutcome, type ResolvedUser } from '@/lib/adminAuth';
import {
  POLICIES,
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  recordApiCall,
  type RateLimitPolicy,
} from '@/lib/rateLimiter';

/**
 * API 라우트 공통 가드 래퍼.
 *
 * 2026-08-18 전수 감사에서 49개 라우트에 **공통 가드 계층이 전혀 없다는 것**이 치명 결함으로 나왔다.
 * middleware도 없고 라우트 래퍼도 없어서 인증·레이트리밋·에러 형식·관측이 라우트마다 손으로
 * 복제됐고, 그 결과:
 *
 *  - `ADMIN_EMAILS`/`ADMIN_IDS`가 15개 파일에 리터럴로 흩어짐 (일부는 이메일 미검사 변종)
 *  - `/api/search`·`/api/quotes`·`/api/event-candles`·`/api/feedback/report`가 인증·레이트리밋 없이
 *    유료 Finnhub 쿼터와 service-role 쓰기를 유발
 *  - `check-alerts`만 `CRON_SECRET` 미설정 가드가 빠져 `Bearer undefined`로 통과 가능
 *  - `/api/ws-token`이 무인증으로 API 키를 반환
 *
 * 이 래퍼는 그 네 축(인증·레이트리밋·에러·관측)을 한 곳에 모은다.
 * 라우트는 **비즈니스 로직만** 쓰고, 가드는 선언으로 표현한다.
 *
 * ```ts
 * export const GET = defineRoute({
 *   name: '/api/admin/pro-readiness',
 *   auth: 'admin',
 *   handler: async () => NextResponse.json({ ... }),
 * });
 * ```
 *
 * 반환 헤더(Cache-Control 등)는 handler가 만든 응답을 그대로 통과시키므로 라우트가 계속 제어한다.
 */

/** 인증 모드. 기본값은 'public'이 아니라 **명시 필수** — 빼먹어서 무방비가 되는 실수를 막는다. */
export type AuthMode =
  /** 누구나 (그래도 레이트리밋은 붙는다) */
  | 'public'
  /** 로그인 필요 — 401 */
  | 'user'
  /** 로그인 + 관리자 허용목록 — 401 / 403 */
  | 'admin'
  /** Vercel Cron / QStash — CRON_SECRET Bearer */
  | 'cron'
  /** 로그인이면 신원을 붙여주되 비로그인도 통과 (레이트리밋 한도만 갈림) */
  | 'optional';

export interface RouteContext {
  req: NextRequest;
  /** 'user'·'admin'에서는 항상 non-null. 'optional'에서는 비로그인 시 null. */
  user: ResolvedUser | null;
  userId: string | null;
  isAdmin: boolean;
  /** Next.js 동적 세그먼트 params (있는 경우) */
  params: Record<string, string | string[]> | undefined;
}

export interface RouteConfig {
  /** 레이트리밋 집계 키 겸 관측 로그의 endpoint 이름. 실제 경로와 일치시킬 것. */
  name: string;
  auth: AuthMode;
  /**
   * 레이트리밋 정책. 생략하면 `POLICIES.general`.
   * `false`면 비활성 — cron처럼 호출자가 신뢰 가능한 경우만.
   */
  rateLimit?: RateLimitPolicy | false;
  handler: (ctx: RouteContext) => Promise<Response> | Response;
}

type NextRouteHandler = (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string | string[]>> },
) => Promise<Response>;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * cron 인증 — `CRON_SECRET` Bearer.
 *
 * secret이 **미설정이면 차단**한다. 이게 빠지면 `Bearer ${undefined}` 문자열이 만들어져
 * `Authorization: Bearer undefined` 헤더가 인증을 통과한다(2026-08-18 `check-alerts`에서 실제 발견).
 */
function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export function defineRoute(config: RouteConfig): NextRouteHandler {
  const policy = config.rateLimit === false
    ? null
    : (config.rateLimit ?? POLICIES.general);

  return async function routeHandler(req, nextCtx) {
    const started = Date.now();
    const ip = getClientIp(req);

    // ── 1. 인증 ────────────────────────────────────────────────────────────
    let user: ResolvedUser | null = null;
    let isAdmin = false;

    if (config.auth === 'cron') {
      if (!verifyCron(req)) return jsonError(401, 'unauthorized', 'Unauthorized');
    } else if (config.auth !== 'public') {
      const outcome = await resolveUserOutcome(req);
      if (outcome.status === 'unavailable') {
        // 설정 오류(서비스키 누락)를 401로 내보내면 "전부 로그아웃됐다"는 오진을 부른다.
        return jsonError(503, 'storage_unavailable', '일시적으로 이용할 수 없어요. 잠시 후 다시 시도해주세요.');
      }
      user = outcome.status === 'ok' ? outcome.user : null;
      isAdmin = isAdminIdentity(user);

      if (config.auth === 'user' && !user) {
        return jsonError(401, 'unauthorized', '로그인이 필요해요.');
      }
      if (config.auth === 'admin') {
        if (!user) return jsonError(401, 'unauthorized', '로그인이 필요해요.');
        if (!isAdmin) return jsonError(403, 'forbidden', '접근 권한이 없어요.');
      }
    }

    const userId = user?.id ?? null;
    const userKey = userId || `ip:${ip}`;

    // ── 2. 레이트리밋 ──────────────────────────────────────────────────────
    // 신원을 이미 확인했으므로 enforceRateLimit()을 쓰지 않는다
    // (그쪽은 내부에서 getUserIdFromAuth를 다시 불러 auth 왕복이 한 번 더 생긴다).
    if (policy) {
      const check = await checkRateLimit(config.name, userKey, !!userId, policy);
      if (!check.allowed) {
        await recordApiCall({
          endpoint: config.name, userKey, userId, ip,
          status: 429, latencyMs: Date.now() - started, errorCode: 'rate_limit',
        });
        return rateLimitResponse(check);
      }
    }

    // ── 3. 핸들러 ──────────────────────────────────────────────────────────
    let status = 500;
    let errorCode: string | undefined;
    try {
      const params = nextCtx?.params ? await nextCtx.params : undefined;
      const res = await config.handler({ req, user, userId, isAdmin, params });
      status = res.status;
      if (status >= 400) errorCode = `http_${status}`;
      return res;
    } catch (e) {
      errorCode = 'internal_error';
      // 원인은 서버 로그에만. 사용자에게는 내부 구조를 노출하지 않는다.
      console.error(`[${config.name}]`, e);
      return jsonError(500, 'internal_error', '일시적인 오류가 났어요. 잠시 후 다시 시도해주세요.');
    } finally {
      // 관측은 성공·실패 모두 남긴다 — 레이트리밋 집계의 근거이기도 하다.
      await recordApiCall({
        endpoint: config.name, userKey, userId, ip,
        status, latencyMs: Date.now() - started, errorCode,
      });
    }
  };
}

export { POLICIES };
