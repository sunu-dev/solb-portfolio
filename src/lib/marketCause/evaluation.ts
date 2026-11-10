import { digest, instant } from './normalizeFacts';
/** Corpus rows refer to saved official-source evidence, never invented historical
 * prices. The split is stable per underlying event, including its corrections. */
export interface EvaluationCase {
  id: string; eventGroup: string; market: 'kr' | 'us'; kind: 'company' | 'macro' | 'policy';
  scenario: 'up' | 'down' | 'flat' | 'correction' | 'no_evidence' | null;
  split: 'development' | 'holdout'; mode: 'retrospective' | 'point_in_time';
  /** Examples inspected or used to tune parsing/prompts cannot become holdout evidence. */
  developmentExposed: boolean;
  cutoff: string; documents: { hash: string; publishedAt: string; firstSeenAt: string }[];
  expected: 'background' | 'withhold' | 'withdraw' | null; actual: 'background' | 'withhold' | 'withdraw';
  review: null | { method: 'independent_source_review'; reviewer: string; producer: string; policyVersion: string;
    evidenceHash: string; criticalErrors: number; supportedClaims: number; totalClaims: number; understandable: boolean };
}
export function evaluationSplit(eventGroup: string): EvaluationCase['split'] {
  return parseInt(digest(eventGroup).slice(0, 8), 16) % 5 === 0 ? 'holdout' : 'development';
}
export function evaluationEvidenceHash(row: Pick<EvaluationCase, 'eventGroup' | 'cutoff' | 'mode' | 'documents'>): string {
  return digest([row.eventGroup, row.cutoff, row.mode, row.documents]);
}
export interface TradingObservation { tradingDay: string; policyVersion: string; expected: number; completed: number; errors: number; overBudget: boolean }
/** This report is a gate assessment, not authorization to enable a feature.
 * Persistent controls and the publication projection remain separate. */
export function assessNarrativeRollout(rows: EvaluationCase[], observations: TradingObservation[], policyVersion: string) {
  const reasons: string[] = [];
  const ids = new Set<string>(), groups = new Set<string>();
  const reviewed: EvaluationCase[] = [];
  for (const row of rows) {
    if (!row.id || !row.eventGroup || ids.has(row.id) || groups.has(row.eventGroup)) { reasons.push('duplicate_or_missing_event'); continue; }
    ids.add(row.id); groups.add(row.eventGroup);
    if (row.split !== evaluationSplit(row.eventGroup)) { reasons.push('split_mismatch'); continue; }
    if (typeof row.developmentExposed !== 'boolean' || row.split === 'holdout' && row.developmentExposed) { reasons.push('holdout_exposed_to_development'); continue; }
    const cutoff = instant(row.cutoff);
    if (!Number.isFinite(cutoff) || row.documents.some(doc => !/^[a-f0-9]{64}$/.test(doc.hash)
      || !Number.isFinite(instant(doc.publishedAt)) || !Number.isFinite(instant(doc.firstSeenAt))
      || instant(doc.publishedAt) > cutoff || instant(doc.firstSeenAt) > cutoff)) { reasons.push('evidence_unavailable_at_cutoff'); continue; }
    if (row.expected && row.expected !== 'withhold' && !row.documents.length) { reasons.push('missing_evidence'); continue; }
    const r = row.review;
    if (!row.expected || !row.scenario || !r || r.method !== 'independent_source_review' || !r.reviewer || r.reviewer === r.producer || r.policyVersion !== policyVersion
      || r.evidenceHash !== evaluationEvidenceHash(row) || ![r.criticalErrors, r.supportedClaims, r.totalClaims].every(n => Number.isSafeInteger(n) && n >= 0)
      || r.supportedClaims > r.totalClaims) continue;
    reviewed.push(row);
  }
  if (reviewed.length < 200) reasons.push('fewer_than_200_reviewed_events');
  const holdout = reviewed.filter(row => row.split === 'holdout');
  if (holdout.length < 40) reasons.push('insufficient_heldout_events');
  for (const market of ['kr', 'us']) for (const kind of ['company', 'macro', 'policy']) {
    if (holdout.filter(row => row.market === market && row.kind === kind).length < 3) reasons.push(`missing_holdout_${market}_${kind}`);
  }
  for (const scenario of ['up', 'down', 'flat', 'correction', 'no_evidence']) if (holdout.filter(row => row.scenario === scenario).length < 3) reasons.push(`missing_holdout_${scenario}`);
  const totalClaims = holdout.reduce((n, row) => n + row.review!.totalClaims, 0);
  const supported = holdout.reduce((n, row) => n + row.review!.supportedClaims, 0);
  const requiredHolds = holdout.filter(row => row.expected !== 'background');
  const correctHolds = requiredHolds.filter(row => row.actual === row.expected);
  const answerable = holdout.filter(row => row.expected === 'background');
  const answered = answerable.filter(row => row.actual === 'background');
  if (reviewed.some(row => row.review!.criticalErrors)) reasons.push('critical_errors');
  if (!totalClaims || supported / totalClaims < .98) reasons.push('insufficient_claim_support');
  if (!requiredHolds.length || correctHolds.length / requiredHolds.length < .95) reasons.push('unsafe_withholding_or_correction');
  if (!answerable.length || answered.length / answerable.length < .6) reasons.push('insufficient_answerable_coverage');
  if (answered.some(row => !row.review!.understandable)) reasons.push('beginner_review_failed');
  const days = new Set<string>();
  for (const observation of observations) {
    const { tradingDay, expected, completed, errors } = observation;
    // Caller must derive these days from completed market sessions. Weekends and
    // repeated snapshots cannot create extra observed trading days.
    const day = new Date(`${tradingDay}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDay) || !Number.isFinite(day.getTime()) || [0, 6].includes(day.getUTCDay())
      || day.toISOString().slice(0, 10) !== tradingDay || day.getTime() > Date.now() || observation.policyVersion !== policyVersion) continue;
    if (![expected, completed, errors].every(n => Number.isSafeInteger(n) && n >= 0) || expected < 1 || completed !== expected || errors || observation.overBudget) continue;
    days.add(tradingDay);
  }
  if (days.size < 10) reasons.push('fewer_than_10_clean_trading_days');
  return { eligible: reasons.length === 0, policyVersion, reasons: [...new Set(reasons)],
    registered: rows.length, reviewed: reviewed.length, heldout: holdout.length, observedDays: days.size,
    supportRate: totalClaims ? supported / totalClaims : null, withholdingRate: requiredHolds.length ? correctHolds.length / requiredHolds.length : null,
    answerableCoverage: answerable.length ? answered.length / answerable.length : null };
}
