import type { SupabaseClient } from '@supabase/supabase-js';

export type InviteAccess = 'checking' | 'allowed' | 'required' | 'error';
export type InviteCheck = { userId: string; status: InviteAccess };

export function currentInviteAccess(userId: string, result: InviteCheck | null): InviteAccess {
  return result?.userId === userId ? result.status : 'checking';
}

/** UI admission only: API/DB authorization remains a separate boundary. */
export async function resolveInviteAccess(
  client: SupabaseClient, userId: string, request: typeof fetch = fetch,
): Promise<InviteAccess> {
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session || session.user.id !== userId) return 'error';
    const [configResponse, adminResponse] = await Promise.all([
      request('/api/config'),
      request('/api/me/admin', { headers: { Authorization: `Bearer ${session.access_token}` } }),
    ]);
    if (!configResponse.ok || !adminResponse.ok) return 'error';
    const [{ config }, admin] = await Promise.all([configResponse.json(), adminResponse.json()]);
    if (!config || typeof config.service_mode !== 'string' || typeof admin.isAdmin !== 'boolean') return 'error';
    if (admin.isAdmin) return 'allowed';
    if (config.service_mode !== 'beta') return 'allowed';
    if (!['true', 'false'].includes(config.invite_required)) return 'error';
    if (config.invite_required === 'false') return 'allowed';
    const { data, error: readError } = await client.from('user_portfolios')
      .select('invited_by_code').eq('user_id', userId).maybeSingle();
    if (readError) return 'error';
    return data?.invited_by_code ? 'allowed' : 'required';
  } catch {
    return 'error';
  }
}
