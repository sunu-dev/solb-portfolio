import type { SupabaseClient } from '@supabase/supabase-js';
import { AGE_GATE_VERSION } from '@/config/legalVersions';
import { AI_ADULT_CONSENT_TYPE } from '@/lib/aiAgeGate';

const PENDING_KEY = 'solb_consent_pending';

/** DB가 저장 성공을 반환하기 전에는 동의 증거를 버리지 않는다. */
export async function persistPendingConsent(
  client: SupabaseClient,
  userId: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
): Promise<void> {
  const pending = storage.getItem(PENDING_KEY);
  if (!pending) return;
  const consent = JSON.parse(pending) as {
    age_18_plus?: boolean;
    terms?: string;
    privacy?: string;
    ts?: string;
  };
  if (consent.age_18_plus !== true || !consent.terms || !consent.privacy
    || !consent.ts || !Number.isFinite(Date.parse(consent.ts))) {
    throw new Error('invalid pending consent');
  }
  const { error } = await client.from('user_consents').upsert(
    [
      { user_id: userId, consent_type: AI_ADULT_CONSENT_TYPE, version: AGE_GATE_VERSION, agreed_at: consent.ts },
      { user_id: userId, consent_type: 'terms', version: consent.terms, agreed_at: consent.ts },
      { user_id: userId, consent_type: 'privacy', version: consent.privacy, agreed_at: consent.ts },
    ],
    { onConflict: 'user_id,consent_type,version', ignoreDuplicates: true },
  );
  if (error) throw new Error('consent persistence failed');
  // 저장 중 새 동의가 들어왔다면 그 기록은 지우지 않는다.
  if (storage.getItem(PENDING_KEY) === pending) storage.removeItem(PENDING_KEY);
}
