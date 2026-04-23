import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ─── Rate limit 정책 ────────────────────────────────────────────────────────
export interface RateLimitPolicy {
  /** 윈도우 길이 (초) */
  windowSec: number;
  /** 로그인 유저 허용 호출 수 */
  maxLoggedIn: number;
  /** 비로그인 유저 허용 호출 수 */
  maxAnon: number;
}

// 엔드포인트별 정책 프리셋 — 필요 시 route.ts에서 재정의 가능
export const POLICIES = {
  /** AI 분석 — 무거움 */
  aiAnalysis: { windowSec: 3600, maxLoggedIn: 15, maxAnon: 3 },
  /** OCR — 매우 무거움 (이미지 토큰) */
  ocr:        { windowSec: 3600, maxLoggedIn:  5, maxAnon: 1 },
  /** 뉴스 — 가벼움 */
  news:       { windowSec: 60,   maxLoggedIn: 60, maxAnon: 20 },
  /** 일반 외부 API */
  general:    { windowSec: 60,   maxLoggedIn: 120, maxAnon: 30 },
} as const;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix sec
  limit: number;
}

/**
 * IP 추출 (프록시 뒤에 있으므로 x-forwarded-for 헤더 활용)
 */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * Supabase auth 토큰으로 유저 식별
 */
export async function getUserIdFromAuth(req: NextRequest): Promise<string | null> {
  if (!supabase) return null;
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    return user?.id || null;
  } catch { return null; }
}

/**
 * Sliding window rate limiter
 * - Supabase의 api_calls 테이블에서 window 내 호출 수 집계
 * - 비용을 절감하기 위해 Supabase 사용 (Redis 없을 때)
 *
 * key: user_id (로그인) 또는 ip (비로그인)
 * endpoint: /api/ai-chok 등
 */
export async function checkRateLimit(
  endpoint: string,
  userKey: string,
  isLoggedIn: boolean,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const limit = isLoggedIn ? policy.maxLoggedIn : policy.maxAnon;
  const nowSec = Math.floor(Date.now() / 1000);
  const resetAt = nowSec + policy.windowSec;

  if (!supabase) {
    // Supabase 없으면 fail-open (rate limit 없이 통과)
    return { allowed: true, remaining: limit, resetAt, limit };
  }

  try {
    const sinceIso = new Date(Date.now() - policy.windowSec * 1000).toISOString();
    const { count } = await supabase
      .from('api_calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_key', userKey)
      .eq('endpoint', endpoint)
      .gte('created_at', sinceIso);

    const used = count || 0;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    return { allowed, remaining, resetAt, limit };
  } catch {
    // 조회 실패 시 fail-open
    return { allowed: true, remaining: limit, resetAt, limit };
  }
}

/**
 * API 호출 기록 (rate limit 집계용 + 관측성)
 */
export async function recordApiCall(params: {
  endpoint: string;
  userKey: string;
  userId?: string | null;
  ip?: string | null;
  status: number;
  latencyMs: number;
  errorCode?: string;
}) {
  if (!supabase) return;
  try {
    await supabase.from('api_calls').insert({
      endpoint: params.endpoint,
      user_key: params.userKey,
      user_id: params.userId || null,
      ip: params.ip || null,
      status: params.status,
      latency_ms: params.latencyMs,
      error_code: params.errorCode || null,
    });
  } catch { /* silent */ }
}

/**
 * 429 응답 빌더
 */
export function rateLimitResponse(result: RateLimitResult, customMsg?: string) {
  const retryAfter = result.resetAt - Math.floor(Date.now() / 1000);
  return NextResponse.json(
    {
      error: customMsg || '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
      code: 'rate_limit',
      hint: `약 ${Math.max(1, Math.ceil(retryAfter / 60))}분 후 다시 이용할 수 있어요.`,
      limit: result.limit,
      remaining: 0,
      resetAt: result.resetAt,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/**
 * 고수준 헬퍼: 진입 시점에 한 번 호출.
 * 사용 예:
 *   const gate = await enforceRateLimit(req, '/api/ai-analysis', POLICIES.aiAnalysis);
 *   if (!gate.ok) return gate.response;
 *   ... 본문 ...
 *   await gate.finalize(200, undefined);
 */
export async function enforceRateLimit(
  req: NextRequest,
  endpoint: string,
  policy: RateLimitPolicy,
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; finalize: (status: number, errorCode?: string) => Promise<void> }
> {
  const started = Date.now();
  const ip = getClientIp(req);
  const userId = await getUserIdFromAuth(req);
  const isLoggedIn = !!userId;
  const userKey = userId || `ip:${ip}`;

  const check = await checkRateLimit(endpoint, userKey, isLoggedIn, policy);
  if (!check.allowed) {
    await recordApiCall({
      endpoint, userKey, userId, ip,
      status: 429, latencyMs: Date.now() - started, errorCode: 'rate_limit',
    });
    return { ok: false, response: rateLimitResponse(check) };
  }

  return {
    ok: true,
    finalize: async (status: number, errorCode?: string) => {
      await recordApiCall({
        endpoint, userKey, userId, ip,
        status, latencyMs: Date.now() - started, errorCode,
      });
    },
  };
}
