import { describe, expect, it, vi } from 'vitest';
import { extractSecConcept } from '@/lib/marketCause/sources/sec';
import { explainCompanyFacts } from '@/lib/marketCause/companyFacts';
import { saveCompanyFacts } from '@/lib/marketCause/companyFactsCycle';
import { attachCompanyExplanations } from '@/lib/marketCause/explanationEngine';
import { createNarrativeRelease, validNarrativeRelease, type NarrativeRelease } from '@/lib/marketCause/narrativeRelease';
import { NARRATIVE_POLICY } from '@/lib/marketCause/narrativeReview';
import { NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL } from '@/lib/marketCause/narrativeModel';
import type { ShadowSnapshot, ShadowPort } from '@/lib/marketCause/shadowCycle';
import type { MarketFlowBrief } from '@/lib/marketFlowEngine';

const now = '2026-10-31T06:00:00Z';
const accession = '0000050863-26-000100';
const context = { asOf: now, windowStart: '2026-10-24T00:00:00Z', entityIds: ['CIK0000050863'] };
function snapshot(values = [100, 200], periods = [['2026-07-01', '2026-09-30'], ['2025-07-01', '2025-09-30']]): ShadowSnapshot {
  const rows = values.map((val, i) => ({ val, start: periods[i][0], end: periods[i][1], accn: accession, filed: '2026-10-30', form: '10-Q' }));
  const extracted = extractSecConcept({ cik: '0000050863', concept: 'RevenueFromContractWithCustomerExcludingAssessedTax',
    body: { cik: 50863, taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', units: { USD: rows } },
    filings: [{ accession, filed: '2026-10-30', form: '10-Q', acceptedAt: '2026-10-30T20:00:00Z' }], firstSeenAt: now, retrievedAt: now });
  return { context, ...extracted, decision: { disposition: 'facts_only', claims: [], rejected: [], reasonCodes: [], inputHash: 'a'.repeat(64), policyVersion: 'fixture' } };
}
describe('automatic company facts and explanatory rules', () => {
  it('compares exact periods from the same official filing with a conditional path', () => {
    const [card] = explainCompanyFacts('INTC', snapshot(), now);
    expect(card.title).toBe('인텔, 전년 같은 기간보다 매출은 줄었어요');
    expect(card.comparison).toMatchObject({ current: '100', previous: '200', currentPeriod: '2026-07-01~2026-09-30' });
    expect(card.sources[0].url).toContain(`${accession}-index.html`);
    expect(card.condition).toContain('확정 원인은 아니에요'); expect(card.path).toContain('비용');
  });
  it('preserves evidence signatures after JSONB reorders keys', () => {
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v;
    expect(explainCompanyFacts('INTC', reorder(snapshot()) as ShadowSnapshot, now)).toEqual(explainCompanyFacts('INTC', snapshot(), now));
  });
  it('does not fall back to prior years when the current row has been altered', () => {
    const rows = snapshot([100, 200, 150], [['2026-07-01', '2026-09-30'], ['2025-07-01', '2025-09-30'], ['2024-07-01', '2024-09-30']]);
    rows.facts[0].value = '1';
    expect(explainCompanyFacts('INTC', rows, now)).toEqual([]);
  });
  it('never compares a quarter with year-to-date or unrelated fiscal periods', () => {
    for (const periods of [[['2026-01-01', '2026-09-30'], ['2025-07-01', '2025-09-30']], [['2026-07-01', '2026-09-30'], ['2025-04-01', '2025-06-30']]])
      expect(explainCompanyFacts('INTC', snapshot([100, 200], periods), now)).toEqual([]);
  });
  it('supports genuine 52/53-week comparable periods without calling them calendar quarters', () => {
    const rows = snapshot([100, 200], [['2026-06-28', '2026-09-26'], ['2025-06-29', '2025-09-27']]);
    expect(explainCompanyFacts('INTC', rows, now)[0].comparison?.currentPeriod).toBe('2026-06-28~2026-09-26');
  });
  it('withholds conflicting values, future, stale, withdrawn and altered sources', () => {
    expect(explainCompanyFacts('INTC', snapshot([100, 200, 101], [['2026-07-01', '2026-09-30'], ['2025-07-01', '2025-09-30'], ['2026-07-01', '2026-09-30']]), now)).toEqual([]);
    const s = snapshot();
    for (const change of [(x: ShadowSnapshot) => { x.facts[0].value = '999'; }, (x: ShadowSnapshot) => { x.documents[0].url = 'https://evil.test/fact'; },
      (x: ShadowSnapshot) => { x.documents[0].status = 'withdrawn'; }, (x: ShadowSnapshot) => { x.decision.disposition = 'withdrawn'; },
      (x: ShadowSnapshot) => { x.context.asOf = '2026-11-01T00:00:00Z'; }]) {
      const copy = structuredClone(s); change(copy); expect(explainCompanyFacts('INTC', copy, now)).toEqual([]);
    }
    expect(explainCompanyFacts('AMZN', s, now)).toEqual([]);
    expect(explainCompanyFacts('INTC', s, '2026-11-08T00:00:00Z')).toEqual([]);
  });
  it('binds each source cell to its metric, period and company even if the payload is malformed', () => {
    const s = snapshot(); s.facts[0].periodStart = '2026-01-01';
    expect(explainCompanyFacts('INTC', s, now)).toEqual([]);
    expect(explainCompanyFacts('UNKNOWN', snapshot(), now)).toEqual([]);
  });
  it('links by exact symbol and labels a later release without retroactive price attribution', () => {
    const card = explainCompanyFacts('INTC', snapshot(), now)[0];
    const brief = { market: 'us', asOf: '2026-10-30T19:00:00Z', companies: [{ symbol: 'INTC' }] } as MarketFlowBrief;
    expect(attachCompanyExplanations([brief], [card])[0].companyExplanations?.[0].timing).toBe('after_observation');
    expect(attachCompanyExplanations([{ ...brief, market: 'kr' }], [card])[0].companyExplanations).toEqual([]);
    expect(attachCompanyExplanations([{ ...brief, companies: [] }], [card])[0].companyExplanations).toEqual([]);
  });
  it('saves corrections and withdrawals independently of narrative/model success', async () => {
    const old = snapshot(), next = snapshot([99, 200]);
    const publish = vi.fn().mockResolvedValue('stored');
    const port: ShadowPort = { read: async () => ({ revision: 1, snapshot: old }), claim: async () => ({ status: 'claimed', fence: 1 }), publish };
    expect(await saveCompanyFacts({ symbol: 'INTC', owner: 'fixture', context, documents: next.documents, facts: next.facts, port })).toBe('stored');
    expect(publish.mock.calls[0][0].snapshot.company.corrected).toBe(true);
    await saveCompanyFacts({ symbol: 'INTC', owner: 'fixture', context, documents: [], facts: [], port });
    expect(publish.mock.calls[1][0].snapshot.decision.disposition).toBe('withdrawn');
  });
});
describe('narrative rollout is executable and fail-closed', () => {
  it('refuses to manufacture release readiness from no evaluation or elapsed time', () => {
    expect(() => createNarrativeRelease([], [], now)).toThrow('rollout_not_ready');
    expect(validNarrativeRelease(null, now)).toBe(false);
  });
  it('expires release certificates and invalidates changed policies/models/quality', () => {
    // Synthetic gate fixture, never installed or counted as real evaluation.
    const gate: NarrativeRelease = { scope: 'company_background', policy: NARRATIVE_POLICY, models: [NARRATIVE_MODEL, NARRATIVE_REVIEW_MODEL],
      evidenceHash: 'a'.repeat(64), approvedAt: now, expiresAt: '2026-11-07T06:00:00Z',
      evaluation: { eligible: true, policyVersion: NARRATIVE_POLICY, reasons: [], registered: 200, reviewed: 200, heldout: 40, observedDays: 10, supportRate: .99, withholdingRate: .99, answerableCoverage: .9 } };
    expect(validNarrativeRelease(gate, now)).toBe(true);
    expect(validNarrativeRelease(gate, gate.expiresAt)).toBe(false);
    expect(validNarrativeRelease({ ...gate, policy: 'old' }, now)).toBe(false);
    expect(validNarrativeRelease({ ...gate, models: ['unknown'] }, now)).toBe(false);
    expect(validNarrativeRelease({ ...gate, evaluation: { ...gate.evaluation, supportRate: .5 } }, now)).toBe(false);
  });
});
