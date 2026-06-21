import { supabase } from './supabase';

// knownUserId: 호출부가 이미 세션을 확인했으면 전달 → getSession 재조회 생략(만료 경계 레이스 제거, logTourEvent 등).
export async function logApiCall(action: string, symbol?: string, metadata?: Record<string, unknown>, knownUserId?: string) {
  try {
    let userId = knownUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) return; // only log for logged-in users

    await supabase.from('api_logs').insert({
      user_id: userId,
      action,
      symbol: symbol || null,
      metadata: metadata || {},
    });
  } catch { /* silent */ }
}
