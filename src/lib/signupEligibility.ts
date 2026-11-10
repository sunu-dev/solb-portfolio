import type { SupabaseClient } from '@supabase/supabase-js';
import { AGE_GATE_VERSION, TERMS_VERSION, PRIVACY_VERSION } from '@/config/legalVersions';
import { AI_ADULT_CONSENT_TYPE } from '@/lib/aiAgeGate';
import { persistPendingConsent } from '@/lib/pendingConsent';
import { withAbortDeadline } from '@/lib/withAbortDeadline';

export type SignupConsentType = typeof AI_ADULT_CONSENT_TYPE | 'terms' | 'privacy';
export interface SignupRequirements {
  status: 'eligible' | 'required' | 'error';
  missing: SignupConsentType[];
}

/** Only a completed write followed by a current-version read may open the gate. */
export async function resolveSignupRequirements(
  client: SupabaseClient,
  userId: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  signal?: AbortSignal,
): Promise<SignupRequirements> {
  try {
    await persistPendingConsent(client, userId, storage, signal);
    if (signal?.aborted) return { status: 'error', missing: [] };
    const { data, error } = await readSignupConsents(client, userId, signal);
    if (error || !data) return { status: 'error', missing: [] };
    const required: [SignupConsentType, string][] = [
      [AI_ADULT_CONSENT_TYPE, AGE_GATE_VERSION],
      ['terms', TERMS_VERSION],
      ['privacy', PRIVACY_VERSION],
    ];
    const missing = required.filter(([type, version]) => !data.some(row =>
      row.consent_type === type && row.version === version)).map(([type]) => type);
    return { status: missing.length ? 'required' : 'eligible', missing };
  } catch {
    return { status: 'error', missing: [] };
  }
}

/** Retry only the idempotent read, never the pending consent write above. */
async function readSignupConsents(client: SupabaseClient, userId: string, parentSignal?: AbortSignal) {
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withAbortDeadline(signal => client.from('user_consents')
        .select('consent_type,version').eq('user_id', userId)
        .in('consent_type', [AI_ADULT_CONSENT_TYPE, 'terms', 'privacy']).abortSignal(signal),
      attempt === 0 ? 3000 : Math.max(1, Math.min(1500, 4500 - (Date.now() - started))), parentSignal);
      const code = result.error?.code ?? '';
      const transient = !!result.error && (/^08|^53|^57P0|^PGRST00[0-3]$|^57014$/.test(code)
        || (!code && (result.status === 0 || result.status >= 500)));
      if (!transient || attempt === 1 || parentSignal?.aborted || Date.now() - started >= 4500) return result;
    } catch (error) {
      const transient = error instanceof TypeError || error instanceof Error
        && (error.message === 'Request deadline exceeded' || error.name === 'AbortError' || error.name === 'TimeoutError');
      if (!transient || attempt === 1 || parentSignal?.aborted || Date.now() - started >= 4500) throw error;
    }
  }
  throw new Error('Consent read unavailable');
}

export async function resolveSignupEligibility(
  client: SupabaseClient,
  userId: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
): Promise<SignupRequirements['status']> {
  return (await resolveSignupRequirements(client, userId, storage)).status;
}
