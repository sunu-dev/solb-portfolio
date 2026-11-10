import { COMPANY_REGISTRY, type CompanySymbol } from './companyRegistry';
import { makeNarrativePacket, parseHypotheses, assessNarratives, PATHWAYS, NARRATIVE_POLICY } from './narrativeReview';
import { validNarrativeRelease, type NarrativeRelease } from './narrativeRelease';
import { digest, canonicalDigest, instant } from './normalizeFacts';
import type { ShadowSnapshot } from './shadowCycle';
import type { CompanyExplanation } from './companyTypes';
/** Public projection is a separate decision. Rebuild exact source bindings and
 * rerun all schema/review rules; never trust a stored approved prose array. */
export function explainCompanyNarrative(symbol: string, snapshot: ShadowSnapshot, release: NarrativeRelease | null, now: string): CompanyExplanation[] {
  if (!Object.hasOwn(COMPANY_REGISTRY, symbol) || !validNarrativeRelease(release, now)) return [];
  const identity = COMPANY_REGISTRY[symbol as CompanySymbol], n = snapshot.narrative, a = n?.run.assessment;
  if (!n || n.run.status !== 'reviewed' || !a || a.policyVersion !== NARRATIVE_POLICY || a.status !== 'shadow_supported'
    || snapshot.decision.disposition === 'withdrawn' || instant(now) - instant(snapshot.context.asOf) > 4 * 86400000
    || !Number.isFinite(instant(snapshot.context.asOf)) || instant(snapshot.context.asOf) > instant(now)) return [];
  try {
    const packet = makeNarrativePacket(n.documents, snapshot.context);
    if (packet.inputHash !== a.inputHash || canonicalDigest(a.candidates) !== a.hypothesesHash) return [];
    const candidates = parseHypotheses({ hypotheses: a.candidates }, packet);
    const checked = assessNarratives(packet, candidates, { inputHash: a.inputHash, hypothesesHash: a.hypothesesHash, reviewedPassages: Object.keys(packet.passages), reviews: a.reviews });
    return checked.hypotheses.filter(h => h.entityId === `CIK${identity.cik}`).flatMap(h => {
      const sources = [...new Set(h.support.map(key => packet.passages[key].documentId))].map(id => n.documents.find(d => d.id === id)!);
      if (sources.some(d => d.entityId !== h.entityId || !/^\d{10}-\d{2}-\d{6}$/.test(d.accession)
        || !d.url.startsWith(`https://www.sec.gov/Archives/edgar/data/${Number(identity.cik)}/${d.accession.replace(/-/g, '')}/`)
        || !/^[-a-zA-Z0-9_.]+\.html?$/.test(d.url.split('/').at(-1)!)
        || instant(now) - instant(d.publishedAt!) > 7 * 86400000)) return [];
      const path = PATHWAYS[h.pathway];
      return [{ id: digest([a.inputHash, h.id]), symbol, name: identity.name, kind: 'company_statement' as const,
        title: `${identity.name} 발표에서 확인한 사업 변화`, summary: h.summary, ...path,
        condition: '회사 발표에서 확인한 배경 설명이에요. 발표에 포함되지 않은 사정이나 시장 예상은 확인되지 않았고, 주가 변동의 원인으로 확정한 내용은 아니에요.',
        publishedAt: new Date(Math.max(...sources.map(d => instant(d.publishedAt!)))).toISOString(), checkedAt: snapshot.context.asOf,
        corrected: n.documents.some(d => d.status !== 'active'), sources: sources.map(d => ({ label: 'SEC에 제출한 회사 발표', url: d.url })) }];
    });
  } catch { return []; }
}
