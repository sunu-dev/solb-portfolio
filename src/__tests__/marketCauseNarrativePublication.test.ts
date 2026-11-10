import { expect, it } from 'vitest';
import { explainCompanyNarrative } from '@/lib/marketCause/companyNarrative';
import { makeNarrative } from '@/lib/marketCause/narrativeEvidence';
import { assessNarratives, makeNarrativePacket, NARRATIVE_POLICY, parseHypotheses } from '@/lib/marketCause/narrativeReview';
import { canonicalDigest } from '@/lib/marketCause/normalizeFacts';
import { NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL } from '@/lib/marketCause/narrativeModel';
import type { NarrativeRelease } from '@/lib/marketCause/narrativeRelease';
import type { ShadowSnapshot } from '@/lib/marketCause/shadowCycle';
const now = '2026-10-31T06:00:00Z';
const context = { asOf: now, windowStart: '2026-10-29T00:00:00Z', entityIds: ['CIK0000050863'] };
const document = makeNarrative({ cik: '0000050863', accession: '0000050863-26-000100', url: 'https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/ex99.htm',
  html: '<p>We expect customer demand to increase and are planning to expand production capacity to serve these customers during the coming year.</p>', publishedAt: '2026-10-30T20:00:00Z', retrievedAt: now });
const packet = makeNarrativePacket([document], context);
const hypotheses = parseHypotheses({ hypotheses: [{ id: 'h1', entityId: context.entityIds[0], summary: '회사는 고객 수요에 맞춰 생산 능력을 늘릴 계획이라고 밝혔어요.', pathway: 'demand_supply', support: ['p0'], counterEvidence: [] }] }, packet);
const assessment = assessNarratives(packet, hypotheses, { inputHash: packet.inputHash, hypothesesHash: canonicalDigest(hypotheses), reviewedPassages: ['p0'],
  reviews: [{ id: 'h1', verdict: 'supported', sourceSupport: true, pathwaySupport: true, scopeCorrect: true, counterEvidence: [], counterResolutions: [], reason: 'Synthetic review fixture' }] });
const snapshot: ShadowSnapshot = { context, documents: [], facts: [], decision: { disposition: 'facts_only', claims: [], rejected: [], reasonCodes: [], inputHash: '', policyVersion: 'fixture' },
  narrative: { documents: [document], run: { status: 'reviewed', assessment, errorCode: null, publicEligible: false } } };
// Unit fixture only. Never a real evaluation artifact or production authorization.
const release: NarrativeRelease = { scope: 'company_background', policy: NARRATIVE_POLICY, models: [NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL], evidenceHash: 'a'.repeat(64), approvedAt: now,
  expiresAt: '2026-11-07T06:00:00Z', evaluation: { eligible: true, policyVersion: NARRATIVE_POLICY, reasons: [], registered: 200, reviewed: 200, heldout: 40, observedDays: 10, supportRate: 1, withholdingRate: 1, answerableCoverage: 1 } };
it('completes source → review → gated public explanation without exposing internal audit', () => {
  const cards = explainCompanyNarrative('INTC', snapshot, release, now);
  expect(cards).toHaveLength(1); expect(cards[0].summary).toBe(hypotheses[0].summary);
  expect(cards[0].path).toContain('판매량'); expect(cards[0].sources[0].url).toBe(document.url);
  expect(JSON.stringify(cards)).not.toContain('Synthetic review fixture');
  expect(explainCompanyNarrative('INTC', snapshot, null, now)).toEqual([]);
});
it('rechecks reviews and exact candidate content instead of trusting stored approval', () => {
  const changed = structuredClone(snapshot); changed.narrative!.run.assessment!.candidates[0].summary = '회사는 생산 능력을 늘리는 작업을 완료했다고 밝혔어요.';
  expect(explainCompanyNarrative('INTC', changed, release, now)).toEqual([]);
  const rejected = structuredClone(snapshot); rejected.narrative!.run.assessment!.reviews[0].sourceSupport = false;
  expect(explainCompanyNarrative('INTC', rejected, release, now)).toEqual([]);
});
it('removes withdrawn, changed-company and expired explanations', () => {
  const revoked = structuredClone(snapshot); revoked.narrative!.documents[0].status = 'withdrawn';
  expect(explainCompanyNarrative('INTC', revoked, release, now)).toEqual([]);
  expect(explainCompanyNarrative('AMZN', snapshot, release, now)).toEqual([]);
  expect(explainCompanyNarrative('INTC', snapshot, release, '2026-11-05T06:00:00Z')).toEqual([]);
});
