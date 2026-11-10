import { describe, it, expect } from 'vitest';
import { assessNarrativeRollout, evaluationEvidenceHash, evaluationSplit, type EvaluationCase } from '@/lib/marketCause/evaluation';
const base = (): EvaluationCase => ({ id: 'one', eventGroup: 'event:one', market: 'us', kind: 'company', scenario: 'down',
  split: evaluationSplit('event:one'), mode: 'retrospective', developmentExposed: false, cutoff: '2026-10-31T00:00:00Z', documents: [{ hash: 'a'.repeat(64), publishedAt: '2026-10-30T00:00:00Z', firstSeenAt: '2026-10-31T00:00:00Z' }],
  expected: 'background', actual: 'background', review: null });
describe('release evaluation integrity', () => {
  it('does not reuse a tuning example as an untouched holdout event', () => {
    const row = base(); let i = 0;
    do { row.eventGroup = `holdout:${i++}`; } while (evaluationSplit(row.eventGroup) !== 'holdout');
    row.split = 'holdout'; row.developmentExposed = true;
    expect(assessNarrativeRollout([row], [], 'p1').reasons).toContain('holdout_exposed_to_development');
  });
  it('never treats unreviewed fixtures or a functioning endpoint as release evidence', () => {
    const result = assessNarrativeRollout([base()], [], 'p1');
    expect(result).toMatchObject({ eligible: false, registered: 1, reviewed: 0, observedDays: 0 });
    expect(result.reasons).toContain('fewer_than_200_reviewed_events');
  });
  it('prevents leakage across corrections, duplicates and manipulated splits', () => {
    const row = base();
    expect(assessNarrativeRollout([row, { ...row, id: 'two' }], [], 'p1').reasons).toContain('duplicate_or_missing_event');
    expect(assessNarrativeRollout([{ ...row, split: row.split === 'holdout' ? 'development' : 'holdout' }], [], 'p1').reasons).toContain('split_mismatch');
  });
  it('rejects late evidence and cannot relabel current downloads as historical availability', () => {
    const row = base(); row.cutoff = '2026-10-30T12:00:00Z'; row.mode = 'point_in_time';
    expect(assessNarrativeRollout([row], [], 'p1').reasons).toContain('evidence_unavailable_at_cutoff');
  });
  it('binds an independent review to the exact corpus and policy', () => {
    const row = base();
    row.review = { method: 'independent_source_review', reviewer: 'independent-reviewer', producer: 'draft-model', policyVersion: 'p1', evidenceHash: evaluationEvidenceHash(row), criticalErrors: 0, supportedClaims: 1, totalClaims: 1, understandable: true };
    expect(assessNarrativeRollout([row], [], 'p1').reviewed).toBe(1);
    expect(assessNarrativeRollout([row], [], 'p2').reviewed).toBe(0);
    row.documents[0].hash = 'b'.repeat(64); expect(assessNarrativeRollout([row], [], 'p1').reviewed).toBe(0);
    row.review.evidenceHash = evaluationEvidenceHash(row); row.review.reviewer = row.review.producer;
    expect(assessNarrativeRollout([row], [], 'p1').reviewed).toBe(0);
  });
  it('does not count duplicate or weekend observations as trading days', () => {
    const observation = { tradingDay: '2026-10-30', policyVersion: 'p1', expected: 8, completed: 8, errors: 0, overBudget: false };
    expect(assessNarrativeRollout([], [observation, observation, { ...observation, tradingDay: '2026-10-31' }], 'p1').observedDays).toBe(1);
  });
});
