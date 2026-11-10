import { digest } from './normalizeFacts';
import { COMPANY_FACT_POLICY } from './companyFacts';
import { evaluatePublication } from './publicationPolicy';
import type { ShadowPort, ShadowSnapshot } from './shadowCycle';
import type { Context, NormalizedFact, SourceDocument } from './types';

/** Replace the complete adapter snapshot before attempting narrative models.
 * A failed/limited model cannot prevent current facts or a correction appearing. */
export async function saveCompanyFacts(input: { symbol: string; owner: string; context: Context;
  documents: SourceDocument[]; facts: NormalizedFact[]; port: ShadowPort }) {
  const event = `facts:${input.symbol}`, previous = await input.port.read(event);
  const fingerprint = digest([COMPANY_FACT_POLICY, input.symbol, input.context.asOf.slice(0, 10),
    input.documents.map(d => [d.id, d.hash, d.status]), input.facts.map(f => f.provenanceHash)]);
  if (previous?.snapshot.company?.fingerprint === fingerprint) return 'finished';
  // The same source may be restored after a temporary withholding. Fence the
  // transition against that intervening head instead of reusing a finished job.
  const hash = digest([fingerprint, previous?.revision ?? 0]);
  const key = `facts:${hash}`, claim = await input.port.claim(key, event, hash, input.owner);
  if (claim.status !== 'claimed') return claim.status;
  const old = previous?.snapshot;
  const corrected = input.facts.some(f => old?.facts.some(p => p.metric === f.metric && p.definition === f.definition
    && p.periodStart === f.periodStart && p.periodEnd === f.periodEnd && p.value !== f.value));
  const decision = evaluatePublication({ context: input.context, documents: input.documents, facts: input.facts, candidates: [] });
  if (!input.facts.length && old?.facts.length) decision.disposition = 'withdrawn';
  const snapshot: ShadowSnapshot = { context: input.context, documents: input.documents, facts: input.facts, decision,
    company: { symbol: input.symbol, policy: COMPANY_FACT_POLICY, corrected: corrected || !!old?.company?.corrected, fingerprint } };
  return input.port.publish({ key, hash, owner: input.owner, fence: claim.fence,
    expectedRevision: previous?.revision ?? 0, snapshot });
}
