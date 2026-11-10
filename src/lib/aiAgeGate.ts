import type { SupabaseClient } from '@supabase/supabase-js';
import { AGE_GATE_VERSION } from '@/config/legalVersions';
import { withAbortDeadline } from '@/lib/withAbortDeadline';

export const AI_ADULT_CONSENT_TYPE = 'age_18_plus';

function parseBirthDate(value: string): Date | null {
  // 직접 입력(YYYYMMDD)과 기존 ISO 형식만 허용한다. 부분 입력은 거부한다.
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
    ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function getAgeFromBirthDate(value: string, now = new Date()): number | null {
  const birthDate = parseBirthDate(value);
  if (!birthDate || birthDate > now) return null;

  let age = now.getFullYear() - birthDate.getFullYear();
  const birthdayPassed = now.getMonth() > birthDate.getMonth()
    || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function isAdultBirthDate(value: string, now = new Date()): boolean {
  const age = getAgeFromBirthDate(value, now);
  return age !== null && age >= 18;
}

/**
 * Gemini API를 호출할 수 있는 성인 동의 증거를 서버에서 확인한다.
 * 조회 실패·환경 미설정·구버전 동의는 모두 fail-closed다.
 */
export type AdultAiConsentOutcome = { status: 'granted' | 'required' | 'unavailable' };

export async function checkCurrentAdultAiConsent(
  client: SupabaseClient | null,
  userId: string,
): Promise<AdultAiConsentOutcome> {
  if (!client) return { status: 'unavailable' };
  if (!userId) return { status: 'required' };
  const started = Date.now();
  // Retry only this idempotent read. Never reuse a prior grant or retry a write.
  // The ordinary request keeps its 3s deadline; recovery has at most 1.5s more.
  for (let attempt = 0; attempt < 2; attempt++) {
    let transient = false;
    let reason = 'database';
    try {
      const { data, error, status } = await withAbortDeadline(signal => client
        .from('user_consents')
        .select('id')
        .eq('user_id', userId)
        .eq('consent_type', AI_ADULT_CONSENT_TYPE)
        .eq('version', AGE_GATE_VERSION)
        .limit(1)
        .abortSignal(signal)
        .maybeSingle(), attempt === 0 ? 3000 : Math.max(1, Math.min(1500, 4500 - (Date.now() - started))));
      if (!error) {
        if (attempt) console.info('[ai-consent-read]', JSON.stringify({ outcome: 'recovered', attempts: 2, durationMs: Date.now() - started }));
        return { status: data ? 'granted' : 'required' };
      }
      const code = error.code ?? '';
      transient = /^08|^53|^57P0|^PGRST00[0-3]$|^57014$/.test(code)
        || (!code && (status === 0 || status >= 500));
      reason = transient ? 'temporary_database' : 'database';
    } catch (error) {
      const failure = error instanceof Error ? error : undefined;
      const timeout = failure?.message === 'Request deadline exceeded' || failure?.name === 'AbortError' || failure?.name === 'TimeoutError';
      transient = timeout || failure instanceof TypeError;
      reason = timeout ? 'timeout' : transient ? 'network' : 'unexpected';
    }
    // Log enums and elapsed time only: no account, query, token, question or DB payload.
    console.warn('[ai-consent-read]', JSON.stringify({ outcome: 'unavailable', reason, attempt: attempt + 1, durationMs: Date.now() - started }));
    if (!transient || attempt === 1 || Date.now() - started >= 4500) break;
  }
  return { status: 'unavailable' };
}

/** Compatibility view: unavailable consent still fails closed for existing callers. */
export async function hasCurrentAdultAiConsent(client: SupabaseClient | null, userId: string): Promise<boolean> {
  return (await checkCurrentAdultAiConsent(client, userId)).status === 'granted';
}
