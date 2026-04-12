import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * 서버 사이드 API 호출 로깅 (api_logs 테이블)
 * 외부 API(Finnhub, Yahoo, Google News 등) 호출 추적용
 */
export async function logServerApi(
  action: string,
  metadata?: Record<string, unknown>,
) {
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
