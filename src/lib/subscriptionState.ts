export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

const ALLOWED_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  trialing: ['active', 'past_due', 'canceled', 'expired'],
  active: ['past_due', 'canceled', 'expired'],
  past_due: ['active', 'canceled', 'expired'],
  canceled: [],
  expired: [],
};

export function canTransitionSubscription(
  current: SubscriptionStatus,
  next: SubscriptionStatus,
): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].includes(next);
}

export interface SubscriptionEntitlementInput {
  status: SubscriptionStatus;
  currentPeriodEnd?: string | null;
}

export interface SubscriptionEntitlementResult {
  active: boolean;
  accessUntil: string | null;
  reason: 'active' | 'trialing' | 'past_due_grace' | 'period_ended' | 'inactive_status' | 'invalid_period';
}

/**
 * 결제 상태를 PRO 권한으로 바꾸는 서버용 결정 함수.
 * past_due는 결제사 일시 장애를 고려해 기간 종료 뒤 기본 3일만 유예한다.
 */
export function deriveSubscriptionEntitlement(
  input: SubscriptionEntitlementInput,
  now = Date.now(),
  pastDueGraceDays = 3,
): SubscriptionEntitlementResult {
  const periodEnd = input.currentPeriodEnd ? Date.parse(input.currentPeriodEnd) : Number.NaN;
  if (!Number.isFinite(periodEnd)) {
    return { active: false, accessUntil: null, reason: 'invalid_period' };
  }

  if (input.status === 'active' || input.status === 'trialing') {
    return periodEnd > now
      ? { active: true, accessUntil: input.currentPeriodEnd || null, reason: input.status }
      : { active: false, accessUntil: input.currentPeriodEnd || null, reason: 'period_ended' };
  }

  if (input.status === 'past_due') {
    const graceUntil = periodEnd + pastDueGraceDays * 86_400_000;
    return now <= graceUntil
      ? { active: true, accessUntil: new Date(graceUntil).toISOString(), reason: 'past_due_grace' }
      : { active: false, accessUntil: new Date(graceUntil).toISOString(), reason: 'period_ended' };
  }

  return { active: false, accessUntil: input.currentPeriodEnd || null, reason: 'inactive_status' };
}

