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

// 성공한 클라이언트만 캐시한다. `null`(키 미설정)은 캐시하지 않는다 —
// 캐시하면 나중에 env가 갖춰져도 그 인스턴스에서는 영영 null이 돌아온다
// (`next dev`에서 .env.local을 고쳐도 안 살아나는 증상).
let serviceClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

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
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) return null;

  serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return serviceClient;
}

/**
 * anon 클라이언트 — **토큰 검증 전용**.
 * `auth.getUser(token)`으로 요청자 신원을 확인할 때만 쓰고, 데이터 접근에는 쓰지 않는다.
 */
export function getAuthClient(): SupabaseClient | null {
  assertServer('getAuthClient');
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;

  authClient = createClient(url, key, { auth: { persistSession: false } });
  return authClient;
}

/**
 * 캐시된 클라이언트를 버린다 — **테스트 전용**.
 *
 * 이 모듈은 프로세스당 싱글턴을 유지한다. 테스트가 케이스마다 다른 mock 클라이언트를
 * 기대하는데 첫 인스턴스가 고정되면 두 번째 케이스부터 stale을 받는다
 * (실제로 cronCheckAlertsCurrency 테스트가 이 방식으로 깨졌다).
 * 프로덕션 코드에서는 호출하지 말 것.
 *
 * ⚠️ 싱글턴이므로 이 클라이언트에 **요청별 상태(헤더·세션)를 얹지 마라** —
 * 같은 인스턴스를 공유하는 모든 서버 코드로 새어나간다.
 */
export function resetSupabaseServerClientsForTests(): void {
  serviceClient = null;
  authClient = null;
}

/**
 * service-role 클라이언트를 **반드시** 얻는다. 키가 없으면 던진다.
 *
 * 왜 이게 따로 필요한가: 여러 라우트가 모듈 스코프에서
 * `createClient(url!, serviceKey!)`를 호출했다. Next는 빌드 중 page data를 수집하며
 * 라우트 모듈을 import하므로, 키가 없으면 `Error: supabaseKey is required`로
 * **빌드 전체가 실패**했다(서비스키 없는 프리뷰 환경은 빌드조차 불가).
 *
 * 이 함수는 **호출 시점**에만 검사하므로, 라우트에서
 * `const db = () => requireServiceClient();` 처럼 지연 참조로 쓰면
 * 설정 누락이 빌드가 아니라 해당 요청의 500으로 국소화된다.
 */
export function requireServiceClient(): SupabaseClient {
  const client = getServiceClient();
  if (!client) {
    throw new Error(
      'Supabase service-role client unavailable: set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).',
    );
  }
  return client;
}

/** anon 클라이언트를 반드시 얻는다. 토큰 검증 전용 — 데이터 접근에는 쓰지 않는다. */
export function requireAuthClient(): SupabaseClient {
  const client = getAuthClient();
  if (!client) {
    throw new Error(
      'Supabase anon client unavailable: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return client;
}
