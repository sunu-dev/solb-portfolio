import { supabase } from './supabase';

export async function logApiCall(action: string, symbol?: string, metadata?: Record<string, unknown>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return; // only log for logged-in users

    await supabase.from('api_logs').insert({
      user_id: userId,
      action,
      symbol: symbol || null,
      metadata: metadata || {},
    });
  } catch { /* silent */ }
}
