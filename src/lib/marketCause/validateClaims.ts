import type { Candidate, CheckedClaim, Context, NormalizedFact, SourceDocument } from './types';
import { compareDecimal, hasValidProvenance, instant, validDay } from './normalizeFacts';

const labels = { revenue: '매출', net_income: '순이익', operating_cash_flow: '영업활동 현금흐름', capital_expenditure: '설비투자 지출', eps: '주당순이익', policy_rate: '정책금리' };
const format = (fact: NormalizedFact) => {
  const [whole, fraction] = fact.value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}${({USD:'달러', KRW:'원', 'USD/share':'달러/주', percent:'%'})[fact.unit]}`;
};
/** Comparison requires the identical metric definition, unit, period and accounting basis. */
export function comparableFacts(a: NormalizedFact, b: NormalizedFact): boolean {
  return (['entityId', 'metric', 'unit', 'periodStart', 'periodEnd', 'basis', 'scope', 'definition'] as const)
    .every(key => a[key] === b[key]);
}
export function documentReasons(doc: SourceDocument, context: Context): string[] {
  const asOf = instant(context.asOf); const seen = instant(doc.firstSeenAt); const retrieved = instant(doc.retrievedAt);
  const errors: string[] = [];
  if (!Number.isFinite(asOf) || !Number.isFinite(instant(context.windowStart)) || instant(context.windowStart) > asOf) errors.push('invalid_context');
  if (!Number.isFinite(seen) || !Number.isFinite(retrieved) || seen > asOf || retrieved > asOf || retrieved < seen) errors.push('unavailable_at_cutoff');
  if (doc.status !== 'active') errors.push('inactive_source');
  if (doc.precision === 'instant') {
    const published = instant(doc.publishedAt!);
    if (!Number.isFinite(published) || published > asOf || published > seen) errors.push('invalid_publication_time');
  } else if (doc.precision === 'day') {
    if (!doc.publishedAt || !validDay(doc.publishedAt) || doc.publishedAt > context.asOf.slice(0,10)) errors.push('invalid_publication_day');
  } else errors.push('unknown_publication_time');
  try { const url = new URL(doc.url); if (url.protocol !== 'https:' || url.username || url.password || !doc.sourceId) errors.push('invalid_source'); }
  catch { errors.push('invalid_source'); }
  return errors;
}
export function checkCandidate(candidate: Candidate, facts: Map<string, NormalizedFact>, docs: Map<string, SourceDocument>, context: Context): {
  claim?: CheckedClaim; reasons: string[];
} {
  const ids = candidate.kind === 'fact' ? [candidate.factId] : candidate.kind === 'versus_consensus'
    ? [candidate.actualId, candidate.expectedId] : candidate.factIds;
  const reasons: string[] = [];
  if (!Array.isArray(ids) || !ids.length || ids.length > 4) return { reasons: ['invalid_references'] };
  const selected: NormalizedFact[] = [];
  for (const id of ids) {
    const fact = facts.get(id); const doc = fact && docs.get(fact.documentId);
    if (!fact || !doc) { reasons.push('missing_evidence'); continue; }
    selected.push(fact); reasons.push(...documentReasons(doc, context));
    if (!hasValidProvenance(fact, doc)) reasons.push('altered_evidence');
    if (!context.entityIds.includes(fact.entityId)) reasons.push('wrong_entity');
    if (fact.role === 'actual' && fact.periodEnd > context.asOf.slice(0, 10)) reasons.push('future_actual');
  }
  if (reasons.length) return { reasons: [...new Set(reasons)] };
  let text = '';
  if (candidate.kind === 'fact') {
    const f = selected[0];
    text = `${f.entityId}의 ${f.periodStart}~${f.periodEnd} ${f.basis === 'adjusted' ? '조정 ' : ''}${labels[f.metric]} ${f.role === 'guidance' ? '전망은' : f.role === 'consensus' ? '예상치는' : '발표값은'} ${format(f)}예요.`;
  } else if (candidate.kind === 'versus_consensus') {
    const [a,b] = selected; const actualDoc = docs.get(a.documentId)!; const expectedDoc = docs.get(b.documentId)!;
    if (a.role !== 'actual' || b.role !== 'consensus' || !comparableFacts(a,b)) reasons.push('incomparable_consensus');
    // Both public availability AND our observation must precede the result.
    if (actualDoc.precision !== 'instant' || expectedDoc.precision !== 'instant'
      || instant(expectedDoc.publishedAt!) >= instant(actualDoc.publishedAt!)
      || instant(expectedDoc.firstSeenAt) >= instant(actualDoc.publishedAt!)
      || instant(actualDoc.publishedAt!) < instant(context.windowStart)) reasons.push('not_prior_consensus');
    const direction = compareDecimal(a.value,b.value);
    text = `${a.entityId}의 ${labels[a.metric]} 발표값 ${format(a)}는 발표 전에 확인한 예상치 ${format(b)}보다 ${direction < 0 ? '낮아요' : direction > 0 ? '높아요' : '높거나 낮지 않고 같아요'}. 이 차이만으로 주가 변동의 원인을 확정하지 않아요.`;
  } else if (candidate.kind === 'mechanism' && candidate.rule === 'capital_spending_cash') {
    const f=selected[0]; const doc=docs.get(f.documentId)!;
    if (selected.length !== 1 || f.metric !== 'capital_expenditure' || f.role !== 'actual' || compareDecimal(f.value,'0') <= 0) reasons.push('invalid_mechanism_input');
    if (doc.precision !== 'instant' || instant(doc.publishedAt!) < instant(context.windowStart)) reasons.push('unrelated_publication_window');
    text = '설비투자는 장비와 시설에 쓰는 돈이에요. 다른 조건이 같다면 이 지출이 커질수록 당장 남는 현금은 줄 수 있어요. 확인된 지출 자체가 이번 주가 변동의 원인이라는 뜻은 아니에요.';
  } else reasons.push('unsupported_claim');
  return reasons.length ? { reasons: [...new Set(reasons)] } : { reasons: [], claim: {
    id: candidate.id, kind: candidate.kind, text, factIds: ids,
    documentIds: [...new Set(selected.map(f=>f.documentId))], interpretation: candidate.kind === 'mechanism',
  } };
}
