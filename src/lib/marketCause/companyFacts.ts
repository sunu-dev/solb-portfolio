import { compareDecimal, digest, hasValidProvenance, instant } from './normalizeFacts';
import { documentReasons } from './validateClaims';
import { COMPANY_REGISTRY, type CompanySymbol } from './companyRegistry';
import { SEC_CONCEPTS, conceptUrl, type SecConcept } from './sources/sec';
import type { ShadowSnapshot } from './shadowCycle';
import type { NormalizedFact, SourceDocument } from './types';
import type { CompanyExplanation } from './companyTypes';

export const COMPANY_FACT_POLICY = 'company-comparison-v1';
const DAY = 86400000;
const RULES = {
  revenue: { label: '매출', meaning: '매출은 회사가 상품과 서비스를 팔아 벌어들인 금액이에요.',
    path: '매출 변화는 판매량·가격·사업 구성의 영향을 받아요. 비용도 함께 바뀌므로 매출 증가가 이익 증가를 뜻하지는 않아요.', next: '다음 실적에서 매출 변화가 이익과 영업 현금흐름에도 이어지는지 확인해요.' },
  net_income: { label: '순이익', meaning: '순이익은 매출에서 비용과 세금 등을 반영하고 남은 이익이에요.',
    path: '이익 변화는 기업 가치 평가에 영향을 줄 수 있어요. 본업의 변화인지, 일회성 비용·이익 때문인지 구분해야 해요.', next: '영업이익과 일회성 항목, 다음 실적 전망을 함께 확인해요.' },
  operating_cash_flow: { label: '영업활동 현금흐름', meaning: '영업활동 현금흐름은 본업을 운영하면서 실제로 들어오고 나간 현금의 차이예요.',
    path: '들어오는 현금이 줄면 투자·부채 상환에 쓸 여력이 줄 수 있어요. 대금 수금이나 재고 변화 때문에 일시적으로 달라지기도 해요.', next: '재고·매출채권의 변화와 설비투자 지출을 함께 확인해요.' },
  capital_expenditure: { label: '설비투자 지출', meaning: '설비투자는 장비와 시설을 확보하는 데 쓰는 돈이에요.',
    path: '다른 조건이 같다면 지출이 커질수록 당장 남는 현금은 줄어요. 장기적으로 생산·매출이 늘 가능성과 회수에 걸리는 시간도 함께 봐야 해요.', next: '투자한 시설의 가동 시점과 이후 매출, 본업에서 들어오는 현금을 확인해요.' },
} as const;
type SupportedMetric = keyof typeof RULES;
const duration = (f: NormalizedFact) => (Date.parse(f.periodEnd) - Date.parse(f.periodStart)) / DAY + 1;
function isPriorYear(current: NormalizedFact, previous: NormalizedFact): boolean {
  return (['entityId', 'metric', 'unit', 'basis', 'scope', 'definition'] as const).every(k => current[k] === previous[k])
    && Math.abs((Date.parse(current.periodEnd) - Date.parse(previous.periodEnd)) / DAY - 365) <= 7
    && Math.abs((Date.parse(current.periodStart) - Date.parse(previous.periodStart)) / DAY - 365) <= 7
    && Math.abs(duration(current) - duration(previous)) <= 7;
}
function boundFact(f: NormalizedFact, d: SourceDocument, symbol: CompanySymbol, snapshot: ShadowSnapshot): boolean {
  const cik = COMPANY_REGISTRY[symbol].cik;
  const tag = f.definition.replace(/^us-gaap:/, '') as SecConcept;
  return Object.hasOwn(RULES, f.metric) && Object.hasOwn(SEC_CONCEPTS, tag)
    && f.definition === `us-gaap:${tag}` && SEC_CONCEPTS[tag].metric === f.metric && SEC_CONCEPTS[tag].unit === f.unit
    && f.unit === 'USD' && f.scale === 0 && f.locator === 'value' && f.role === 'actual' && f.basis === 'gaap'
    && (f.metric !== 'capital_expenditure' || compareDecimal(f.value, '0') >= 0)
    && f.entityId === `CIK${cik}` && d.sourceId === 'sec-companyconcept' && d.url === conceptUrl(cik, tag)
    && d.cells.tag === tag && d.cells.start === f.periodStart && d.cells.end === f.periodEnd && d.cells.unit === 'USD'
    && /^\d{10}-\d{2}-\d{6}$/.test(d.cells.accession) && hasValidProvenance(f, d)
    && !documentReasons(d, snapshot.context).length && d.precision === 'instant'
    && f.periodEnd <= snapshot.context.asOf.slice(0, 10) && duration(f) >= 60 && duration(f) <= 380;
}
/** Pure deterministic publication: validates adapter identity and exact fiscal
 * periods, compares only the same filing's prior-year values. No consensus or
 * price attribution is inferred. Restated filings replace the whole evidence set. */
export function explainCompanyFacts(symbol: string, snapshot: ShadowSnapshot, now: string): CompanyExplanation[] {
  if (!Object.hasOwn(COMPANY_REGISTRY, symbol)) return [];
  const company = symbol as CompanySymbol, identity = COMPANY_REGISTRY[company];
  if (snapshot.decision.disposition === 'withdrawn' || !Number.isFinite(instant(now))
    || !Number.isFinite(instant(snapshot.context.asOf)) || instant(snapshot.context.asOf) > instant(now)
    || instant(now) - instant(snapshot.context.asOf) > 4 * DAY || snapshot.documents.length > 500 || snapshot.facts.length > 500) return [];
  const docs = new Map(snapshot.documents.map(d => [d.id, d]));
  if (docs.size !== snapshot.documents.length || new Set(snapshot.facts.map(f => f.id)).size !== snapshot.facts.length) return [];
  const valid = snapshot.facts.filter(f => { const d = docs.get(f.documentId); return d && boundFact(f, d, company, snapshot)
    && instant(now) - instant(d.publishedAt!) <= 7 * DAY; });
  const cards: CompanyExplanation[] = [];
  for (const metric of Object.keys(RULES) as SupportedMetric[]) {
    // Do not silently fall back to an older period if a newer row is corrupt.
    if (snapshot.facts.filter(f => f.metric === metric).some(f => !valid.includes(f))) continue;
    const all = valid.filter(f => f.metric === metric);
    const latest = Math.max(...all.map(f => instant(docs.get(f.documentId)!.publishedAt!)));
    const inFiling = all.filter(f => instant(docs.get(f.documentId)!.publishedAt!) === latest);
    if (new Set(inFiling.map(f => docs.get(f.documentId)!.cells.accession)).size !== 1
      || new Set(inFiling.map(f => f.definition)).size !== 1) continue;
    const periods = new Map<string, NormalizedFact>(); let conflicting = false;
    for (const f of inFiling) {
      const key = `${f.periodStart}:${f.periodEnd}`, prior = periods.get(key);
      if (prior && compareDecimal(prior.value, f.value) !== 0) conflicting = true;
      periods.set(key, f);
    }
    if (conflicting) continue;
    const ordered = [...periods.values()].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || duration(a) - duration(b));
    const current = ordered[0]; if (!current) continue;
    const previous = ordered.filter(f => isPriorYear(current, f));
    if (previous.length !== 1) continue;
    const prior = previous[0], rule = RULES[metric], direction = compareDecimal(current.value, prior.value);
    const verb = direction > 0 ? '늘었어요' : direction < 0 ? '줄었어요' : '같아요';
    const label = metric === 'net_income' && compareDecimal(current.value, '0') < 0 && compareDecimal(prior.value, '0') < 0
      ? `적자 폭이 ${direction > 0 ? '줄었어요' : direction < 0 ? '늘었어요' : '같아요'}`
      : metric === 'net_income' && compareDecimal(current.value, '0') === 0 && compareDecimal(prior.value, '0') < 0 ? '순이익이 적자에서 손익분기점으로 바뀌었어요'
        : metric === 'net_income' && compareDecimal(current.value, '0') > 0 && compareDecimal(prior.value, '0') < 0 ? '순이익이 흑자로 전환됐어요'
        : metric === 'net_income' && compareDecimal(current.value, '0') < 0 && compareDecimal(prior.value, '0') >= 0 ? '순이익이 적자로 전환됐어요'
          : `${rule.label}${metric === 'net_income' ? '이' : '은'} ${verb}`;
    const source = docs.get(current.documentId)!;
    const accession = source.cells.accession;
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${Number(identity.cik)}/${accession.replace(/-/g, '')}/${accession}-index.html`;
    cards.push({ id: digest([COMPANY_FACT_POLICY, symbol, current.provenanceHash, prior.provenanceHash]), symbol, name: identity.name,
      title: `${identity.name}, 전년 같은 기간보다 ${label}`, kind: 'financial_comparison',
      summary: `${current.periodStart}~${current.periodEnd} 공시 수치를 전년의 대응 기간과 비교했어요.`, meaning: rule.meaning,
      path: rule.path, next: rule.next, condition: '공시된 실적의 비교예요. 발표 전 시장 예상과 비교한 결과나 이번 주가 변동의 확정 원인은 아니에요.',
      publishedAt: source.publishedAt!, checkedAt: snapshot.context.asOf,
      corrected: !!snapshot.company?.corrected,
      sources: [{ label: 'SEC 공시 원문', url: filingUrl }, { label: 'SEC 구조화 수치', url: source.url }],
      comparison: { label: rule.label, current: current.value, previous: prior.value, unit: '달러',
        currentPeriod: `${current.periodStart}~${current.periodEnd}`, previousPeriod: `${prior.periodStart}~${prior.periodEnd}` } });
  }
  return cards;
}
