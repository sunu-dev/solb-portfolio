import { canonicalDigest, instant } from './normalizeFacts';
import { NARRATIVE_POLICY, makeNarrativePacket, assessNarratives, parseHypotheses } from './narrativeReview';
import { validNarrativeRelease, type NarrativeRelease } from './narrativeRelease';
import { evaluationSplit } from './evaluation';
import { explainCompanyFacts } from './companyFacts';
import type { ShadowSnapshot } from './shadowCycle';
import { COMPANY_REGISTRY } from './companyRegistry';
export interface QualityHead { event: string; version: string; snapshot: ShadowSnapshot }
export function auditExplanationQuality(heads: QualityHead[], release: NarrativeRelease | null, now: string) {
  if (!Number.isFinite(instant(now)) || heads.length > 24) throw new Error('invalid_quality_input');
  const companies: { symbol: string; factCards: number; narrative: string; queuedDraft: boolean }[] = [];
  const cases: { eventGroup: string; version: string; evidenceHash: string; split: 'development' | 'holdout'; developmentExposed: boolean }[] = [];
  const faults: string[] = [];
  for (const symbol of Object.keys(COMPANY_REGISTRY)) {
    const fact = heads.find(h => h.event === `facts:${symbol}`)?.snapshot;
    const row = heads.find(h => h.event === `sec:${symbol}`), n = row?.snapshot.narrative;
    const draft = heads.find(h => h.event === `draft:sec:${symbol}`)?.snapshot.draft;
    let factCards = 0; let narrative: string = n?.run.status ?? 'not_collected';
    try { if (fact) factCards = explainCompanyFacts(symbol, fact, now).length; } catch { faults.push(`invalid_facts:${symbol}`); }
    if (n?.run.assessment) {
      const a = n.run.assessment;
      if (a.policyVersion !== NARRATIVE_POLICY) narrative = 'previous_policy';
      else try {
        const packet = makeNarrativePacket(n.documents, row!.snapshot.context);
        if (a.inputHash !== packet.inputHash || a.hypothesesHash !== canonicalDigest(a.candidates)) throw new Error('binding');
        if (a.candidates.length) {
          const checked = assessNarratives(packet, parseHypotheses({ hypotheses: a.candidates }, packet),
            { inputHash: a.inputHash, hypothesesHash: a.hypothesesHash, reviewedPassages: Object.keys(packet.passages), reviews: a.reviews });
          if (checked.status !== a.status || canonicalDigest(checked.hypotheses) !== canonicalDigest(a.hypotheses)) throw new Error('decision');
        } else if (a.hypotheses.length || a.status !== 'facts_only') throw new Error('empty_candidate');
        narrative = a.status;
        const latest = Object.values(packet.passages).map(p => p.publishedAt).sort().at(-1);
        if (latest) {
          // Conservative company/quarter grouping keeps amendments and nearby
          // releases together; it cannot inflate event counts with revisions.
          const eventGroup = `company:${symbol}:${latest.slice(0, 4)}-Q${Math.ceil(Number(latest.slice(5, 7)) / 3)}`;
          cases.push({ eventGroup, version: row!.version, evidenceHash: canonicalDigest([a.inputHash, a.hypothesesHash]), split: evaluationSplit(eventGroup), developmentExposed: ['INTC','AMZN','MSFT','GOOGL'].includes(symbol) && eventGroup.endsWith('2026-Q4') });
        }
      } catch { narrative = 'invalid_snapshot'; faults.push(`invalid_narrative:${symbol}`); }
    }
    const queuedDraft = !!draft && draft.policy === NARRATIVE_POLICY && Number.isFinite(instant(draft.createdAt))
      && instant(draft.createdAt) <= instant(now) && instant(now) - instant(draft.createdAt) <= 36 * 3600000
      && (!n?.run.assessment || n.run.assessment.inputHash !== draft.inputHash);
    companies.push({ symbol, factCards, narrative, queuedDraft });
  }
  const invalidRelease = !!release && !validNarrativeRelease(release, now);
  if (invalidRelease) faults.push('invalid_or_expired_release');
  return { report: { policy: NARRATIVE_POLICY, companies, faults,
    pendingEvaluation: cases.length, independentlyReviewed: 0, explanationQualityVerified: false }, cases,
    revokeHash: release && (invalidRelease || faults.some(f => f.startsWith('invalid_narrative:'))) ? release.evidenceHash : null };
}
