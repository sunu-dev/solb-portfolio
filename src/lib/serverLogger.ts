import { getAuthClient } from '@/lib/supabaseServer';


/**
 * 서버 사이드 API 호출 로깅 (api_logs 테이블)
 * 외부 API(Finnhub, Yahoo, Google News 등) 호출 추적용
 */
export async function logServerApi(
  action: string,
  metadata?: Record<string, unknown>,
) {
  const supabase = getAuthClient();
  if (!supabase) return;
  try {
    await supabase.from('api_logs').insert({
      user_id: null,
      action,
      symbol: null,
      metadata: metadata || {},
    });
  } catch { /* silent */ }
}
