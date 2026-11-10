import type { BusinessEvidence, BusinessPort, BusinessSnapshot } from './types';
import type { BusinessModel } from './model';
import { evidenceHash, evidenceReasons, hash, validateDraft, validateReview, reviewFeedback } from './validation';
export interface CycleResult { status: 'idle' | 'stale_worker' | 'held' | 'approval_pending' | 'unchanged'; symbol?: string; reason?: string }
/** One bounded job. Checkpointing a draft before review avoids paying to regenerate it after a review outage. */
export async function runBusinessCycle(input: { owner: string; port: BusinessPort; collect(symbol: string): Promise<BusinessEvidence>; model(): BusinessModel; now(): string }): Promise<CycleResult> {
  const job = await input.port.claim(input.owner); if (!job) return { status: 'idle' };
  let snapshot: BusinessSnapshot = structuredClone(job.snapshot);
  try {
    const evidence = await input.collect(job.symbol), now = input.now();
    if (evidence.identity.symbol !== job.symbol || evidenceReasons(evidence, now).length) throw new Error('business_evidence_rejected');
    const same = snapshot.evidence && evidenceHash(snapshot.evidence) === evidenceHash(evidence);
    snapshot = { evidence, draft: same ? snapshot.draft : null, review: same ? snapshot.review : null,
      repair: same ? snapshot.repair : undefined };
    if (snapshot.draft && snapshot.review && validateDraft(snapshot.draft, evidence, now).draft && validateReview(snapshot.review, snapshot.draft, evidence).review) {
      // Unchanged, previously reviewed material needs one freshness checkpoint,
      // not two writes of the same source and draft. CAS still fences stale workers.
      const saved = await input.port.checkpoint(job, snapshot, 'approval_pending', 'unchanged_evidence');
      return { status: saved ? 'unchanged' : 'stale_worker', symbol: job.symbol };
    }
    // Persist a changed document before model work, revoking approval on fingerprint change.
    if (!await input.port.checkpoint(job, snapshot, 'collecting', 'source_checked')) return { status: 'stale_worker', symbol: job.symbol };
    const model = input.model();
    const base = `business:${job.symbol}:${hash([evidenceHash(evidence), job.fence]).slice(0, 40)}`;
    const feedback = snapshot.draft && snapshot.repair?.feedback ? reviewFeedback(snapshot.repair.feedback, snapshot.draft, evidence) : null;
    if (snapshot.repair?.feedback && !feedback) throw new Error('business_repair_binding_invalid');
    if (feedback && !feedback.identityMatches) throw new Error('business_identity_review_failed');
    if (feedback && (!Number.isSafeInteger(snapshot.repair?.attempts) || snapshot.repair!.attempts < 0 || snapshot.repair!.attempts >= 2)) throw new Error('business_repair_limit');
    if (!snapshot.draft || !validateDraft(snapshot.draft, evidence, now).draft || feedback) {
      const result = validateDraft(await model.draft(base + ':draft', evidence, feedback ? { draft: snapshot.draft!, feedback } : undefined), evidence, now);
      if (!result.draft) throw new Error('business_draft_rejected:' + result.reasons.join(','));
      snapshot.draft = result.draft;
      snapshot.review = null;
      snapshot.repair = { attempts: (snapshot.repair?.attempts ?? 0) + (feedback ? 1 : 0), feedback: null };
    }
    if (!await input.port.checkpoint(job, snapshot, 'review_pending', 'draft_validated')) return { status: 'stale_worker', symbol: job.symbol };
    const response = await model.review(base + ':review', evidence, snapshot.draft);
    const result = validateReview(response, snapshot.draft, evidence);
    if (!result.review) {
      const feedback = reviewFeedback(response, snapshot.draft, evidence);
      if (feedback) snapshot.repair = { attempts: snapshot.repair?.attempts ?? 0, feedback };
      throw new Error('business_review_rejected:' + result.reasons.join(','));
    }
    snapshot.review = result.review;
    const saved = await input.port.checkpoint(job, snapshot, 'approval_pending', 'editorial_review_required');
    // A model review is evidence for an editor, never an editorial authorization.
    return { status: saved ? 'approval_pending' : 'stale_worker', symbol: job.symbol };
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'business_collection_failed';
    // Never persist vendor bodies, URLs with keys, credentials or arbitrary source content in error logs.
    const reason = /^[a-z0-9_:,.-]{1,240}$/i.test(raw) ? raw : 'business_attempt_failed';
    const saved = await input.port.checkpoint(job, snapshot, 'blocked', reason);
    return { status: saved ? 'held' : 'stale_worker', symbol: job.symbol, reason };
  }
}
