import { withDeadline } from './withDeadline';
import type { SupabaseClient } from '@supabase/supabase-js';

export type InviteAccess = 'checking' | 'allowed' | 'required' | 'error';
export type InviteCheck = { userId: string; status: InviteAccess };

export function currentInviteAccess(userId: string, result: InviteCheck | null): InviteAccess {
  return result?.userId === userId ? result.status : 'checking';
}

/** UI admission only: API/DB authorization remains a separate boundary. */
async function readInviteAccess(
  client: SupabaseClient, userId: string, request: typeof fetch, signal: AbortSignal,
): Promise<InviteAccess> {
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (signal.aborted || error || !session || session.user.id !== userId) return 'error';
    // An existing invitation already satisfies the beta rule. Read the current
    // user's RLS-protected record before calling two unrelated server functions.
    const invitationState: { result: InviteAccess } = { result: 'checking' };
    const invitation = Promise.resolve(client.from('user_portfolios')
      .select('invited_by_code').eq('user_id', userId).abortSignal(signal).maybeSingle())
      .then(({ data, error: readError }): InviteAccess => readError ? 'error' : data?.invited_by_code ? 'allowed' : 'required')
      .catch((): InviteAccess => 'error')
      .then(result => { invitationState.result = result; return result; });

    const policy = (async (): Promise<InviteAccess> => {
      // Fast invitation reads avoid extra requests. A stalled read must not
      // prevent the independent server policy/admin check from starting.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([invitation, new Promise(resolve => { timer = setTimeout(resolve, 150); })]); }
      finally { clearTimeout(timer); }
      if (signal.aborted) return 'error';
      if (invitationState.result === 'allowed') return 'allowed';
      try {
        const configResult = request('/api/config', { signal })
          .then(async response => response.ok ? (await response.json()).config : null).catch(() => null);
        const adminResult = request('/api/me/admin', { headers: { Authorization: `Bearer ${session.access_token}` }, signal })
          .then(async response => response.ok ? (await response.json()).isAdmin : null).catch(() => null);
        return await Promise.any([
          adminResult.then(isAdmin => isAdmin === true ? 'allowed' as const : Promise.reject(new Error('Admin not confirmed'))),
          Promise.all([configResult, adminResult]).then(([config, isAdmin]): InviteAccess => {
            if (isAdmin === true) return 'allowed';
            if (isAdmin !== false || !config || typeof config.service_mode !== 'string') return 'error';
            if (config.service_mode !== 'beta') return 'allowed';
            if (!['true', 'false'].includes(config.invite_required)) return 'error';
            return config.invite_required === 'false' ? 'allowed' : 'required';
          }),
        ]);
      } catch { return 'error'; }
    })();

    return await Promise.any([
      invitation.then(result => result === 'allowed' ? result : Promise.reject(new Error('Invitation not confirmed'))),
      policy.then(async result => {
        if (result === 'allowed') return result;
        const invited = await invitation;
        return invited === 'allowed' ? invited : result === 'required' && invited === 'required' ? 'required' : 'error';
      }),
    ]);
  } catch {
    return 'error';
  }
}

export async function resolveInviteAccess(client:SupabaseClient,userId:string,request:typeof fetch=fetch):Promise<InviteAccess> {
  const controller = new AbortController();
  try { return await withDeadline(readInviteAccess(client,userId,request,controller.signal), 6000); }
  catch { return 'error'; }
  finally { controller.abort(); }
}
