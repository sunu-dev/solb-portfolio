import { assessNarrativeRollout, type EvaluationCase, type TradingObservation } from './evaluation';
import { digest, instant } from './normalizeFacts';
import { NARRATIVE_POLICY } from './narrativeReview';
import { NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL } from './narrativeConfig';
export interface NarrativeRelease {
  scope: 'company_background'; policy: string; models: string[]; evidenceHash: string;
  approvedAt: string; expiresAt: string; evaluation: ReturnType<typeof assessNarrativeRollout>;
}
/** Operator installs only the output of this gate, retaining the full reviewed
 * corpus separately. Model verdicts alone can never create this certificate. */
export function createNarrativeRelease(rows: EvaluationCase[], observations: TradingObservation[], now: string): NarrativeRelease {
  if (!Number.isFinite(instant(now)) || rows.length > 10000 || observations.length > 400) throw new Error('invalid_release_input');
  const evaluation = assessNarrativeRollout(rows, observations, NARRATIVE_POLICY);
  if (!evaluation.eligible) throw new Error(`rollout_not_ready:${evaluation.reasons.join(',')}`);
  return { scope: 'company_background', policy: NARRATIVE_POLICY, models: [NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL],
    evidenceHash: digest([rows, observations]), approvedAt: now, expiresAt: new Date(instant(now) + 7 * 86400000).toISOString(), evaluation };
}
export function validNarrativeRelease(release: NarrativeRelease | null, now: string): boolean {
  if (!release || release.scope !== 'company_background' || release.policy !== NARRATIVE_POLICY
    || release.models?.join('|') !== [NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL].join('|') || !/^[a-f0-9]{64}$/.test(release.evidenceHash)) return false;
  const e = release.evaluation;
  return Number.isFinite(instant(now)) && Number.isFinite(instant(release.approvedAt)) && Number.isFinite(instant(release.expiresAt))
    && instant(release.approvedAt) <= instant(now) && instant(now) < instant(release.expiresAt)
    && instant(release.expiresAt) - instant(release.approvedAt) <= 7 * 86400000
    && !!e && e.eligible === true && e.policyVersion === NARRATIVE_POLICY && e.reasons?.length === 0
    && e.reviewed >= 200 && e.heldout >= 40 && e.observedDays >= 10
    && e.supportRate !== null && e.supportRate >= .98 && e.withholdingRate !== null && e.withholdingRate >= .95
    && e.answerableCoverage !== null && e.answerableCoverage >= .6;
}
