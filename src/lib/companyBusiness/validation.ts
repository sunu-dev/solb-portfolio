import { createHash } from 'node:crypto';
import { BUSINESS_FIELDS, BUSINESS_POLICY, type BusinessEvidence, type BusinessDraft, type BusinessReview, type BusinessPublicProfile } from './types';
// PostgreSQL jsonb and model SDKs may reorder object keys. Content identity must
// survive a database round trip; array order and actual values still matter.
export const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)).digest('hex');
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const date = (s: unknown): number => typeof s === 'string' ? Date.parse(s) : NaN;
export function evidenceHash(e: BusinessEvidence): string {
  // Re-observing the same document does not change the draft or trigger a paid generation.
  return hash([BUSINESS_POLICY, e.identity.symbol, e.identity.issuerId, e.documentId, e.url, e.publishedAt, e.contentHash ?? e.bodyHash, e.passages]);
}
export function evidenceReasons(e: BusinessEvidence, now: string): string[] {
  const reasons: string[] = [], clock = date(now), identity = e?.identity;
  if (!identity || !/^[A-Z0-9^.=\-]{1,32}$/.test(identity.symbol) || !identity.name?.trim()) return ['invalid_identity'];
  if (!Number.isFinite(clock) || !Number.isFinite(date(identity.verifiedAt)) || date(identity.verifiedAt) > clock
    || clock - date(identity.verifiedAt) > 8 * 86400000) reasons.push('identity_expired');
  if (!Number.isFinite(date(e.publishedAt)) || date(e.publishedAt) > clock || clock - date(e.publishedAt) > 550 * 86400000) reasons.push('source_period_invalid');
  if (!Number.isFinite(date(e.retrievedAt)) || date(e.retrievedAt) > clock || clock - date(e.retrievedAt) > 8 * 86400000) reasons.push('source_check_expired');
  if (identity.provider === 'sec') {
    const prefix = `https://www.sec.gov/Archives/edgar/data/${Number(identity.issuerId)}/${e.documentId.replaceAll('-', '')}/`;
    if (identity.market !== 'US' || !/^\d{10}$/.test(identity.issuerId) || !/^\d{10}-\d{2}-\d{6}$/.test(e.documentId)
      || !e.url.startsWith(prefix) || !/^[A-Za-z0-9_.-]+\.html?$/.test(e.url.slice(prefix.length))
      || identity.identityUrl !== `https://data.sec.gov/submissions/CIK${identity.issuerId}.json`) reasons.push('source_identity_mismatch');
  } else if (identity.provider === 'dart') {
    if (identity.market !== 'KR' || !/^\d{8}$/.test(identity.issuerId) || !/^\d{14}$/.test(e.documentId)
      || e.url !== `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${e.documentId}`
      || identity.identityUrl !== `https://opendart.fss.or.kr/api/company.json?corp_code=${identity.issuerId}`) reasons.push('source_identity_mismatch');
  } else reasons.push('unsupported_provider');
  if (!/^[a-f0-9]{64}$/.test(e.bodyHash) || e.contentHash !== undefined && !/^[a-f0-9]{64}$/.test(e.contentHash)
    || !Array.isArray(e.passages) || e.passages.length < 2 || e.passages.length > 12) return [...reasons, 'invalid_passages'];
  if (new Set(e.passages.map(p => p.id)).size !== e.passages.length || e.passages.some(p => !/^p\d+$/.test(p.id)
    || typeof p.text !== 'string' || p.text.length < 60 || p.text.length > 2400 || p.hash !== hash(p.text)
    || p.role !== undefined && !['overview','detail'].includes(p.role))) reasons.push('invalid_passages');
  if (e.passages.reduce((n, p) => n + p.text.length, 0) > 18000) reasons.push('evidence_limit');
  return reasons;
}
export function validateDraft(value: unknown, evidence: BusinessEvidence, now: string): { draft: BusinessDraft | null; reasons: string[] } {
  const reasons = evidenceReasons(evidence, now);
  if (!rec(value) || !exact(value, ['policy', 'symbol', 'evidenceHash', 'sections']) || value.policy !== BUSINESS_POLICY
    || value.symbol !== evidence.identity.symbol || value.evidenceHash !== evidenceHash(evidence)
    || !rec(value.sections) || !exact(value.sections, BUSINESS_FIELDS)) return { draft: null, reasons: [...reasons, 'draft_binding_invalid'] };
  const texts = new Set<string>();
  for (const field of BUSINESS_FIELDS) {
    const section = value.sections[field];
    if (!rec(section) || !exact(section, ['text', 'citations']) || typeof section.text !== 'string'
      || section.text.length < 35 || section.text.length > 220 || !/[가-힣]/.test(section.text) || /[<>]|https?:|\[.*\]\(/i.test(section.text)
      || /[^\p{Script=Hangul}\p{Script=Latin}\p{Script=Han}\p{Script=Common}\p{Script=Inherited}\s]/u.test(section.text)
      || /(?:세계|미국|국내|업계|시장).*?(?:1위|최대|최고)|가장\s*(?:많|큰|높|앞선)|독보적|업계\s*선도/.test(section.text)
      || /확인된.*없|준비\s*중|업종으로 분류|자료를 확인해야|매수\s*추천|매도\s*추천|저평가|고평가|목표\s*주가|주가가.*(?:올라|내려|상승|하락)|\d[\d,.]*\s*(?:%|달러|억원|조원)/.test(section.text)
      || texts.has(section.text)) { reasons.push(`invalid_text:${field}`); continue; }
    texts.add(section.text);
    if (!Array.isArray(section.citations) || section.citations.length < 1 || section.citations.length > 3) { reasons.push(`missing_citation:${field}`); continue; }
    if (field === 'summary' && evidence.passages.some(p => p.role === 'overview')
      && !section.citations.some(c => rec(c) && evidence.passages.some(p => p.role === 'overview' && p.id === c.passageId))) reasons.push('summary_overview_required');
    for (const citation of section.citations) {
      if (!rec(citation) || !exact(citation, ['passageId', 'quote']) || typeof citation.quote !== 'string' || citation.quote.length < 20 || citation.quote.length > 1000
        || !evidence.passages.some(p => p.id === citation.passageId && p.text.includes(citation.quote as string))) reasons.push(`invalid_quote:${field}`);
    }
  }
  return { draft: reasons.length ? null : value as unknown as BusinessDraft, reasons };
}
export function validateReview(value: unknown, draft: BusinessDraft, evidence: BusinessEvidence): { review: BusinessReview | null; reasons: string[] } {
  if (!rec(value) || !exact(value, ['policy', 'draftHash', 'evidenceHash', 'checks', 'identityMatches', 'noUnsupportedClaims'])
    || value.policy !== BUSINESS_POLICY || value.draftHash !== hash(draft) || value.evidenceHash !== evidenceHash(evidence)
    || value.identityMatches !== true || value.noUnsupportedClaims !== true || !Array.isArray(value.checks)
    || value.checks.length !== BUSINESS_FIELDS.length) return { review: null, reasons: ['review_binding_or_identity_invalid'] };
  const seen = new Set();
  for (const check of value.checks) {
    if (!rec(check) || !exact(check, ['field', 'supported', 'complete', 'beginnerFriendly', 'issue'])
      || !BUSINESS_FIELDS.includes(check.field as typeof BUSINESS_FIELDS[number]) || seen.has(check.field)
      || check.supported !== true || check.complete !== true || check.beginnerFriendly !== true || check.issue !== '') return { review: null, reasons: ['review_rejected'] };
    seen.add(check.field);
  }
  return { review: value as unknown as BusinessReview, reasons: [] };
}
/** A bound rejection can inform a revision but can never authorize publication. */
export function reviewFeedback(value: unknown, draft: BusinessDraft, evidence: BusinessEvidence): BusinessReview | null {
  if (!rec(value) || !exact(value, ['policy', 'draftHash', 'evidenceHash', 'checks', 'identityMatches', 'noUnsupportedClaims'])
    || value.policy !== BUSINESS_POLICY || value.draftHash !== hash(draft) || value.evidenceHash !== evidenceHash(evidence)
    || typeof value.identityMatches !== 'boolean' || typeof value.noUnsupportedClaims !== 'boolean'
    || !Array.isArray(value.checks) || value.checks.length !== BUSINESS_FIELDS.length) return null;
  const seen = new Set();
  for (const check of value.checks) {
    if (!rec(check) || !exact(check, ['field', 'supported', 'complete', 'beginnerFriendly', 'issue'])
      || !BUSINESS_FIELDS.includes(check.field as typeof BUSINESS_FIELDS[number]) || seen.has(check.field)
      || typeof check.supported !== 'boolean' || typeof check.complete !== 'boolean' || typeof check.beginnerFriendly !== 'boolean'
      || typeof check.issue !== 'string' || check.issue.length > 600 || /[<>]|https?:\/\//i.test(check.issue)
      || ((!check.supported || !check.complete || !check.beginnerFriendly) && check.issue.trim().length < 4)) return null;
    seen.add(check.field);
  }
  return value as unknown as BusinessReview;
}
/** The independent editorial approval is checked by the repository; model output cannot grant it. */
export function publicProjection(e: BusinessEvidence, d: BusinessDraft, r: BusinessReview, now: string): BusinessPublicProfile {
  if (!validateDraft(d, e, now).draft || !validateReview(r, d, e).review) throw new Error('business_publication_rejected');
  return { policy: BUSINESS_POLICY, version: hash(d), symbol: e.identity.symbol, name: e.identity.name,
    summary: d.sections.summary.text, customers: d.sections.customers.text, revenue: d.sections.revenue.text, watch: d.sections.watch.text,
    sources: [{ label: e.title, url: e.url, reviewedAt: e.retrievedAt.slice(0, 10) }], sourcePublishedAt: e.publishedAt,
    checkedAt: e.retrievedAt, validUntil: new Date(Math.min(date(e.retrievedAt) + 8 * 86400000, date(e.publishedAt) + 550 * 86400000)).toISOString() };
}
