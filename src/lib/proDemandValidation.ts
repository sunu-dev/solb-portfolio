export const PRO_DEMAND_EVENT_NAMES = [
  'pro_offer_exposed',
  'pro_offer_opened',
  'pro_offer_dismissed',
  'pro_start_clicked',
  'pro_waitlist_submitted',
  'pro_checkout_started',
  'pro_payment_succeeded',
  'pro_core_value_used',
  'pro_renewed_month_2',
  'pro_cancelled',
] as const;

export type ProDemandEventName = (typeof PRO_DEMAND_EVENT_NAMES)[number];

/** 개인정보·투자정보를 이벤트 속성으로 보내지 않기 위한 허용 필드. */
export interface ProDemandEventProperties {
  placement: 'backup' | 'bulk_import' | 'history' | 'admin_preview';
  priceKrw: number;
  cohort: string;
}

export const PRO_DEMAND_EVENT_SET = new Set<string>(PRO_DEMAND_EVENT_NAMES);
export const PRO_DEMAND_PLACEMENTS = ['backup', 'bulk_import', 'history'] as const;
export type ProDemandPlacement = (typeof PRO_DEMAND_PLACEMENTS)[number];

export function isProDemandPlacement(value: unknown): value is ProDemandPlacement {
  return typeof value === 'string' && PRO_DEMAND_PLACEMENTS.includes(value as ProDemandPlacement);
}

export interface ProDemandCandidate {
  brokerCount: number;
  holdingCount: number;
  visitsLast14Days: number;
  importOrEditCountLast14Days: number;
}

export const PRO_DEMAND_CANDIDATE_THRESHOLDS = Object.freeze({
  brokerCount: 2,
  holdingCount: 15,
  visitsLast14Days: 2,
  importOrEditCountLast14Days: 2,
});

export function isQualifiedProDemandCandidate(candidate: ProDemandCandidate): boolean {
  return candidate.brokerCount >= PRO_DEMAND_CANDIDATE_THRESHOLDS.brokerCount
    && candidate.holdingCount >= PRO_DEMAND_CANDIDATE_THRESHOLDS.holdingCount
    && candidate.visitsLast14Days >= PRO_DEMAND_CANDIDATE_THRESHOLDS.visitsLast14Days
    && candidate.importOrEditCountLast14Days >= PRO_DEMAND_CANDIDATE_THRESHOLDS.importOrEditCountLast14Days;
}

export type ProDemandVerdict = 'insufficient_data' | 'stop_or_redesign' | 'iterate' | 'go';

export interface FakeDoorResult {
  eligibleExposures: number;
  startClicks: number;
  waitlistSubmissions: number;
}

export function evaluateFakeDoorExperiment(result: FakeDoorResult): ProDemandVerdict {
  if (result.eligibleExposures < 100) return 'insufficient_data';

  const startRate = result.startClicks / result.eligibleExposures;
  const waitlistRate = result.waitlistSubmissions / result.eligibleExposures;

  if (startRate < 0.05) return 'stop_or_redesign';
  if (startRate >= 0.12 && waitlistRate >= 0.06) return 'go';
  return 'iterate';
}

export interface PaidBetaResult {
  invited: number;
  paid: number;
  retainedAtDay45: number;
  coreValueUsers: number;
  refunds: number;
  contributionMarginRate: number;
  monthlySupportMinutesPerPaidUser: number;
}

export function evaluatePaidBeta(result: PaidBetaResult): ProDemandVerdict {
  if (result.invited < 20) return 'insufficient_data';
  if (result.paid < 5) return 'stop_or_redesign';

  const refundRate = result.refunds / result.paid;
  const passed = result.retainedAtDay45 >= 4
    && result.coreValueUsers >= 3
    && refundRate <= 0.1
    && result.contributionMarginRate >= 0.7
    && result.monthlySupportMinutesPerPaidUser <= 15;

  return passed ? 'go' : 'iterate';
}
