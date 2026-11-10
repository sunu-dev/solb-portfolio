import { requireServiceClient } from '../supabaseServer';
import { auditExplanationQuality, type QualityHead } from './qualityAudit';
import { NARRATIVE_POLICY } from './narrativeReview';
import type { NarrativeRelease } from './narrativeRelease';
/** Scheduled invariant checks and evaluation registration. This never marks a
 * queued case independently reviewed or turns model publication on. */
export async function runExplanationQuality() {
  const db = requireServiceClient();
  const { data, error } = await db.rpc('read_market_cause_quality_inputs');
  if (error || !data || !Array.isArray(data.heads)) throw new Error('quality_read_unavailable');
  if (data.enabled !== true) return { status: 'disabled' };
  const audit = auditExplanationQuality(data.heads as QualityHead[], data.release as NarrativeRelease | null, new Date().toISOString());
  const stored = await db.rpc('record_market_cause_quality', { p_policy: NARRATIVE_POLICY, p_report: audit.report, p_cases: audit.cases, p_revoke_hash: audit.revokeHash });
  if (stored.error || !stored.data) throw new Error('quality_store_unavailable');
  return { status: stored.data.status, faults: audit.report.faults, pendingEvaluation: audit.cases.length,
    queuedDrafts: audit.report.companies.filter(c => c.queuedDraft).length, releaseRevoked: stored.data.releaseRevoked === true };
}
