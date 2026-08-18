import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트 팩토리.
 *
 * 왜 필요한가: 라우트마다 `createClient(...)`를 각자 만들면서 두 가지 문제가 반복됐다.
 *  1. **anon 키로 service-only 테이블에 접근** — RLS가 `using(false)`인데 anon 클라이언트로 읽고 쓰면
 *     조회는 항상 빈 결과, 쓰기는 조용히 실패한다. 실패를 삼키는 관용구와 겹치면 아무 신호도 남지 않는다.
 *     (2026-05-20 `ai_chok_cache`에서 한 번 겪었고, 2026-08-18 감사에서 `chokDataEnricher`에 미수정 잔존 확인)
 *  2. 환경변수 이름이 `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY` 두 갈래로 흩어져
 *     라우트마다 폴백 순서가 제각각이었다.
 *
 * 규칙: **서버 코드에서 쓰기·집계·service-only 테이블 접근은 반드시 `getServiceClient()`.**
 * anon 클라이언트는 "요청자 본인 토큰으로 신원을 확인"할 때만 쓴다(`getAuthClient()`).
 */

let serviceClient: SupabaseClient | null | undefined;
let authClient: SupabaseClient | null | undefined;

function assertServer(fn: string) {
  if (typeof window !== 'undefined') {
    throw new Error(`${fn}() is server-only and must not be imported into a client bundle.`);
  }
}

/**
 * service-role 클라이언트 — RLS 우회. 쓰기·집계·관리자 조회용.
 * 키가 없으면 null (호출부가 503으로 처리).
 */
export function getServiceClient(): SupabaseClient | null {
  assertServer('getServiceClient');
  if (serviceClient !== undefined) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  serviceClient = url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
  return serviceClient;
}

/**
 * anon 클라이언트 — **토큰 검증 전용**.
 * `auth.getUser(token)`으로 요청자 신원을 확인할 때만 쓰고, 데이터 접근에는 쓰지 않는다.
 */
export function getAuthClient(): SupabaseClient | null {
  assertServer('getAuthClient');
  if (authClient !== undefined) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  authClient = url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
  return authClient;
}
