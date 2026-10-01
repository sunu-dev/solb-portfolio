import type { SupabaseClient } from '@supabase/supabase-js';
import { AGE_GATE_VERSION, TERMS_VERSION, PRIVACY_VERSION } from '@/config/legalVersions';
import { AI_ADULT_CONSENT_TYPE } from '@/lib/aiAgeGate';
import { persistPendingConsent } from '@/lib/pendingConsent';

/** Only a completed write followed by a current-version read may open the gate. */
export async function resolveSignupEligibility(
  client: SupabaseClient,
  userId: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
): Promise<'eligible' | 'required' | 'error'> {
  try {
    await persistPendingConsent(client, userId, storage);
    const { data, error } = await client.from('user_consents')
      .select('consent_type,version').eq('user_id', userId)
      .in('consent_type', [AI_ADULT_CONSENT_TYPE, 'terms', 'privacy']);
    if (error || !data) return 'error';
    const required = [
      [AI_ADULT_CONSENT_TYPE, AGE_GATE_VERSION],
      ['terms', TERMS_VERSION],
      ['privacy', PRIVACY_VERSION],
    ];
    return required.every(([type, version]) => data.some(row =>
      row.consent_type === type && row.version === version)) ? 'eligible' : 'required';
  } catch {
    return 'error';
  }
}
