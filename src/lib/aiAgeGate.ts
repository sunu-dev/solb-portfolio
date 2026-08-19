import type { SupabaseClient } from '@supabase/supabase-js';
import { AGE_GATE_VERSION } from '@/config/legalVersions';

export const AI_ADULT_CONSENT_TYPE = 'age_18_plus';

function parseBirthDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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
export async function hasCurrentAdultAiConsent(
  client: SupabaseClient | null,
  userId: string,
): Promise<boolean> {
  if (!client || !userId) return false;
  try {
    const { data, error } = await client
      .from('user_consents')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_type', AI_ADULT_CONSENT_TYPE)
      .eq('version', AGE_GATE_VERSION)
      .limit(1)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}
