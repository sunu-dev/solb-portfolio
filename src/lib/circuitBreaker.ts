import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ─── Circuit Breaker 정책 ───────────────────────────────────────────────────
export interface CircuitPolicy {
  /** 실패율 계산 윈도우 (초) */
  windowSec: number;
  /** 차단 판단 최소 호출 수 (이 이하는 판단 유예) */
  minCalls: number;
  /** 차단 임계 실패율 (0~1) */
  failureRateThreshold: number;
  /** 차단 지속 시간 (초) */
  openDurationSec: number;
}

export const CIRCUIT_POLICIES = {
  /** AI 엔드포인트 — 실패율 > 50% (5분 20회 이상) → 1분 차단 */
  aiStrict: { windowSec: 300, minCalls: 20, failureRateThreshold: 0.5, openDurationSec: 60 },
  /** 보수적 — 70% + 30호출 → 90초 */
  relaxed:  { windowSec: 300, minCalls: 30, failureRateThreshold: 0.7, openDurationSec: 90 },
} as const;

interface CircuitResult {
  open: boolean;
  /** 차단 해제까지 남은 초 (open=true일 때만) */
  retryAfterSec?: number;
  /** 차단 사유 (로그용) */
  reason?: string;
  /** 관측용 통계 */
  stats: { total: number; errors: number; failureRate: number };
}

/**
 * 특정 엔드포인트의 Circuit 상태 확인.
 *
 * 판단 기준:
 * 1. 윈도우(기본 5분) 내 호출 수가 minCalls 미만 → open=false (데이터 부족)
 * 2. 실패율 >= threshold 이면서 마지막 실패가 openDurationSec 이내 → open=true
 * 3. 그 외 → open=false
 */
export async function checkCircuit(
  endpoint: string,
  policy: CircuitPolicy,
): Promise<CircuitResult> {
  if (!supabase) {
    return { open: false, stats: { total: 0, errors: 0, failureRate: 0 } };
  }

  const now = Date.now();
  const sinceIso = new Date(now - policy.windowSec * 1000).toISOString();

  try {
    const { data } = await supabase
      .from('api_calls')
      .select('status, error_code, created_at')
      .eq('endpoint', endpoint)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);

    const rows = data || [];
    const total = rows.length;
    const errors = rows.filter(r =>
      r.status >= 500 ||
      r.error_code === 'gemini_quota' ||
      r.error_code === 'gemini_failed' ||
      r.error_code === 'gemini_busy'
    ).length;

    const failureRate = total > 0 ? errors / total : 0;

    // 데이터 부족 → 차단하지 않음
    if (total < policy.minCalls) {
      return { open: false, stats: { total, errors, failureRate } };
    }

    if (failureRate < policy.failureRateThreshold) {
      return { open: false, stats: { total, errors, failureRate } };
    }

    // 마지막 실패 시점 기반으로 차단 해제 시점 계산
    const lastFailure = rows.find(r =>
      r.status >= 500 ||
      r.error_code === 'gemini_quota' ||
      r.error_code === 'gemini_failed'
    );
    if (!lastFailure) {
      return { open: false, stats: { total, errors, failureRate } };
    }

    const lastFailMs = new Date(lastFailure.created_at).getTime();
    const elapsedMs = now - lastFailMs;
    const openDurationMs = policy.openDurationSec * 1000;

    if (elapsedMs < openDurationMs) {
      return {
        open: true,
        retryAfterSec: Math.ceil((openDurationMs - elapsedMs) / 1000),
        reason: `실패율 ${Math.round(failureRate * 100)}% (${errors}/${total})`,
        stats: { total, errors, failureRate },
      };
    }

    return { open: false, stats: { total, errors, failureRate } };
  } catch {
    // 조회 실패 → fail-open (차단 안 함)
    return { open: false, stats: { total: 0, errors: 0, failureRate: 0 } };
  }
}

/**
 * 차단 시 응답 생성
 */
export function circuitOpenResponse(result: CircuitResult, endpoint: string) {
  const retryAfter = result.retryAfterSec || 60;
  return NextResponse.json(
    {
      error: 'AI 서비스가 잠시 점검 중이에요. 잠시 후 다시 시도해주세요.',
      code: 'circuit_open',
      hint: `약 ${retryAfter}초 후 자동으로 복구돼요.`,
      retryAfter,
    },
    {
      status: 503,
      headers: {
        'Retry-After': String(retryAfter),
        'X-Circuit-Open': '1',
        'X-Circuit-Endpoint': endpoint,
      },
    }
  );
}
