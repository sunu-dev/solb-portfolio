/**
 * 경량 에러 로깅 — Supabase error_logs 테이블에 기록
 * Sentry 등 외부 서비스 없이 자체 에러 추적
 */

export async function logError(
  source: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  // 콘솔에 항상 출력
  console.error(`[${source}]`, message, metadata || '');

  // Supabase에 비동기 기록 (실패해도 무시)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    await fetch(`${url}/rest/v1/error_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        source,
        message: message.substring(0, 500),
        metadata: metadata || {},
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server',
      }),
    });
  } catch { /* 에러 로깅 자체가 실패해도 무시 */ }
}
