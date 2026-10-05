export interface AnalysisQuota {
  remaining: number;
  /** Calendar date in Korea, matching the server's daily usage ledger. */
  day: string;
}

export const ANALYSIS_DAILY_LIMIT_MESSAGE = '오늘 새 답변을 받을 수 있는 횟수를 모두 사용했어요. 내일 0시(한국시간)에 다시 질문할 수 있고, 이 화면에서 받은 답변은 다시 볼 수 있어요.';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getAnalysisDay(now = Date.now()): string {
  const shifted = new Date(now + KST_OFFSET_MS);
  return Number.isFinite(shifted.getTime()) ? shifted.toISOString().slice(0, 10) : '';
}

function isRemaining(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Yesterday's exhausted quota must not prevent today's first request. */
export function getAnalysisRemaining(quota: AnalysisQuota | null, now = Date.now()): number | null {
  const day = getAnalysisDay(now);
  if (!day || !quota || quota.day !== day || !isRemaining(quota.remaining)) return null;
  return quota.remaining;
}

/**
 * Only the individual daily quota may update this state. Authentication,
 * service-wide capacity, and hourly rate limits also return `remaining: 0`.
 */
export function readAnalysisQuotaResponse(data: unknown, now = Date.now()): AnalysisQuota | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const response = data as Record<string, unknown>;
  if (response.loginForMore === true || !isRemaining(response.remaining)) return null;
  if (response.code != null && response.code !== 'daily_user_limit') return null;

  const legacyDailyLimit = response.code == null
    && response.limitReached === true && isRemaining(response.dailyLimit);
  if (response.success !== true && response.code !== 'daily_user_limit' && !legacyDailyLimit) return null;

  const day = response.day === undefined ? getAnalysisDay(now)
    : typeof response.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(response.day)
      && getAnalysisDay(Date.parse(`${response.day}T00:00:00+09:00`)) === response.day
      ? response.day : '';
  return day ? { remaining: response.remaining, day } : null;
}
