import { getServiceClient, requireServiceClient } from '../supabaseServer';
import { getStoredIndustry } from '../storedIndustry';
import type { BusinessPort, BusinessSnapshot, BusinessPublicProfile } from './types';
import { evidenceHash, hash, publicProjection } from './validation';
export function createBusinessPort(market: 'US' | 'KR' | 'all', symbol?: string): BusinessPort {
  const db = requireServiceClient();
  return {
    async claim(owner) {
      const { data, error } = await db.rpc('claim_company_business', { p_owner: owner, p_market: market, p_symbol: symbol ?? null });
      if (error) throw new Error('business_queue_unavailable'); return data ?? null;
    },
    async checkpoint(job, snapshot, state, reason) {
      const { data, error } = await db.rpc('checkpoint_company_business', { p_symbol: job.symbol, p_owner: job.owner, p_fence: job.fence, p_snapshot: snapshot,
        p_state: state, p_reason: reason, p_evidence_hash: snapshot.evidence ? evidenceHash(snapshot.evidence) : null, p_draft_hash: snapshot.draft ? hash(snapshot.draft) : null });
      if (error) throw new Error('business_checkpoint_unavailable'); return data === true;
    },
  };
}
export type PublishedBusiness = { status: 'published'; profile: BusinessPublicProfile } | { status: 'withheld' | 'none' | 'unavailable' };
export async function readPublishedBusiness(symbol: string, now = new Date().toISOString()): Promise<PublishedBusiness> {
  const resolved = getStoredIndustry(symbol);
  if (['etp', 'instrument', 'shell', 'conflict'].includes(resolved.status)) return { status: 'none' };
  const db = getServiceClient(); if (!db) return { status: 'unavailable' };
  try {
    // Leave room inside the client's 5-second deadline for the database round trip
    // and a cold function connection. A failure still hides any previously withdrawn story.
    const { data, error } = await db.rpc('read_company_business', { p_symbol: resolved.symbol }).abortSignal(AbortSignal.timeout(3000));
    if (error) return { status: 'unavailable' };
    if (!data) return { status: 'none' };
    if (data.withheld === true) return { status: 'withheld' };
    const snapshot = data.snapshot as BusinessSnapshot;
    if (!snapshot?.evidence || !snapshot.draft || !snapshot.review || snapshot.evidence.identity.symbol !== resolved.symbol
      || data.approval?.kind !== 'editorial' || data.approval?.draftHash !== hash(snapshot.draft)
      || data.approval?.evidenceHash !== evidenceHash(snapshot.evidence)) return { status: 'withheld' };
    return { status: 'published', profile: publicProjection(snapshot.evidence, snapshot.draft, snapshot.review, now) };
  } catch { return { status: 'unavailable' }; }
}
