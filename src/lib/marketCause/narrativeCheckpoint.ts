import { canonicalDigest, instant } from './normalizeFacts';
import { parseHypotheses, NARRATIVE_POLICY, type Hypothesis, type NarrativePacket } from './narrativeReview';
import type { ShadowPort } from './shadowCycle';
export interface NarrativeCheckpoint {
  policy: string; inputHash: string; hypothesesHash: string; createdAt: string; evidenceAsOf: string;
  hypotheses: Hypothesis[]; discardedCandidates: { id: string; reason: string }[];
}
export function resumeDraft(checkpoint: NarrativeCheckpoint | undefined, packet: NarrativePacket, now: string): NarrativeCheckpoint | null {
  if (!checkpoint || checkpoint.policy !== NARRATIVE_POLICY || checkpoint.inputHash !== packet.inputHash
    || !Number.isFinite(instant(now)) || !Number.isFinite(instant(checkpoint.createdAt))
    || !Number.isFinite(instant(checkpoint.evidenceAsOf)) || instant(checkpoint.evidenceAsOf) > instant(packet.context.asOf)
    || instant(checkpoint.createdAt) > instant(now) || instant(now) - instant(checkpoint.createdAt) > 36 * 3600000
    || canonicalDigest(checkpoint.hypotheses) !== checkpoint.hypothesesHash) return null;
  try {
    const hypotheses = parseHypotheses({ hypotheses: checkpoint.hypotheses }, packet);
    if (!hypotheses.length || !Array.isArray(checkpoint.discardedCandidates) || checkpoint.discardedCandidates.length > 3) return null;
    return { ...checkpoint, hypotheses };
  } catch { return null; }
}
/** Durable private handoff. A resumed critic does not pay for another draft. */
export async function persistDraft(port: ShadowPort, event: string, owner: string, draft: NarrativeCheckpoint) {
  const target = `draft:${event}`, prior = await port.read(target);
  if (prior?.snapshot.draft && instant(prior.snapshot.draft.evidenceAsOf) > instant(draft.evidenceAsOf)) throw new Error('narrative_stale_checkpoint');
  if (prior?.snapshot.draft?.inputHash === draft.inputHash && prior.snapshot.draft.hypothesesHash === draft.hypothesesHash
    && instant(draft.createdAt) - instant(prior.snapshot.draft.createdAt) <= 36 * 3600000) return;
  const hash = canonicalDigest([target, draft.inputHash, draft.hypothesesHash, prior?.revision ?? 0]);
  const key = `draft:${hash}`, claim = await port.claim(key, target, hash, owner);
  if (claim.status === 'finished') return;
  if (claim.status !== 'claimed') throw new Error('narrative_checkpoint_unavailable');
  const result = await port.publish({ key, hash, owner, fence: claim.fence, expectedRevision: prior?.revision ?? 0,
    snapshot: { context: { asOf: draft.createdAt, windowStart: draft.evidenceAsOf, entityIds: draft.hypotheses.map(h => h.entityId) }, documents: [], facts: [], draft,
      decision: { disposition: 'facts_only', claims: [], rejected: [], reasonCodes: ['draft_awaiting_review'], inputHash: hash, policyVersion: NARRATIVE_POLICY } } });
  if (result !== 'stored') throw new Error('narrative_checkpoint_unavailable');
}
