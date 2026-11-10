import { randomUUID } from 'node:crypto';
import { digest } from './normalizeFacts';
import { POLICY_VERSION } from './publicationPolicy';
import { POLICY_FEEDS, POLICY_RELEASE_VERSION, fetchPolicyText, parsePolicyFeed, parsePolicyRelease } from './sources/policyRelease';
import type { OfficialSnapshot, PolicyAuthority } from './officialTypes';
import type { ShadowPort, ShadowSnapshot } from './shadowCycle';
import { createMarketCauseShadowPort } from './supabaseShadowPort';
import { requireServiceClient } from '../supabaseServer';
interface Dependencies { port: ShadowPort; enabled(): Promise<boolean>; now(): string; text(url: string): Promise<string> }
const defaults = (): Dependencies => ({ port: createMarketCauseShadowPort(), now: () => new Date().toISOString(), text: fetchPolicyText,
  enabled: async () => { const { data, error } = await requireServiceClient().rpc('market_cause_worker_enabled');
    if (error || typeof data !== 'boolean') throw new Error('policy_control_unavailable'); return data; } });
/** Daily shared source refresh. No AI or portfolio reads. Parser rejection of a
 * newly fetched document retracts the old card before any later reprocessing. */
export async function collectPolicyRelease(authority: PolicyAuthority, dependencies?: Dependencies) {
  if (!Object.hasOwn(POLICY_FEEDS, authority)) return { status: 'invalid_authority' };
  const d = dependencies ?? defaults();
  if (!await d.enabled()) return { status: 'disabled' };
  const started = d.now(); const event = `official:${authority}`;
  const hash = digest([POLICY_RELEASE_VERSION, authority, started.slice(0, 10)]); const key = `policy:${hash}`; const owner = randomUUID();
  const previous = await d.port.read(event);
  const claim = await d.port.claim(key, event, hash, owner);
  if (claim.status !== 'claimed') return { status: claim.status };
  let official: OfficialSnapshot;
  let fetchedDocument = false;
  try {
    const links = parsePolicyFeed(await d.text(POLICY_FEEDS[authority]), authority, started);
    if (!links.length) throw new Error('policy_feed_empty');
    const link = links[0];
    if (Date.parse(started) - Date.parse(link.publishedAt) > 90 * 86400000) throw new Error('policy_publication_old');
    const html = await d.text(link.url); fetchedDocument = true;
    const release = parsePolicyRelease(link, html, d.now());
    const old = previous?.snapshot.official?.release;
    // Keep correction status on repeated refreshes of the same release.
    official = { status: 'verified', checkedAt: d.now(), release, reason: null,
      corrected: !!old && old.url === release.url && (old.contentHash !== release.contentHash || previous?.snapshot.official?.corrected === true) };
  } catch (error) {
    const code = error instanceof Error && /^policy_[a-z_]+$/.test(error.message) ? error.message : 'policy_transport_unavailable';
    const withheld = fetchedDocument || ['policy_source_removed', 'policy_feed_empty', 'policy_date_mismatch', 'policy_publication_old', 'policy_source_identity', 'invalid_policy_feed'].includes(code);
    official = { status: withheld ? 'withheld' : 'source_unavailable', checkedAt: d.now(), release: withheld ? null : previous?.snapshot.official?.release ?? null,
      reason: code, corrected: previous?.snapshot.official?.corrected ?? false };
  }
  const snapshot: ShadowSnapshot = { context: { asOf: d.now(), windowStart: started, entityIds: [authority] }, documents: [], facts: [], official,
    decision: { disposition: official.status === 'withheld' ? 'withdrawn' : 'facts_only', claims: [], rejected: [],
      reasonCodes: [official.reason ?? 'official_policy_verified'], inputHash: hash, policyVersion: POLICY_VERSION } };
  const status = await d.port.publish({ key, hash, owner, fence: claim.fence, expectedRevision: previous?.revision ?? 0, snapshot,
    retryable: official.status === 'source_unavailable' });
  return { status, sourceStatus: official.status, reason: official.reason, modelCalls: 0 };
}
