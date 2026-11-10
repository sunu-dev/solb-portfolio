import { unzipSync } from 'fflate';
import { businessDocumentText, BUSINESS_DOCUMENT_LIMIT } from './documentText';
import { hash, evidenceReasons } from './validation';
import type { BusinessEvidence } from './types';
const AGENT = 'Joobi/1.0 sunu.develop@gmail.com'; // Existing public operator contact.
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** SEC delivery scripts can rotate without changing a single filing byte outside scripts.
 * Keep all other markup and text in the fingerprint, including uncited business content.
 */
export function businessDocumentContentHash(html: string): string {
  return hash(html.replace(/<script\b[^>]*>[^]*?<\/script\s*>/gi, ''));
}
export interface SourceDependencies { transport: typeof fetch; now(): string; pause(): Promise<void> }
const defaults = (): SourceDependencies => ({ transport: fetch, now: () => new Date().toISOString(), pause: () => new Promise(r => setTimeout(r, 1100)) });
async function read(url: string, kind: 'json' | 'html' | 'zip', d: SourceDependencies, max = 10_000_000): Promise<Uint8Array> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !['www.sec.gov', 'data.sec.gov', 'opendart.fss.or.kr'].includes(u.hostname) || u.port || u.username || u.password) throw new Error('business_source_not_allowed');
  await d.pause();
  const r = await d.transport(url, { redirect: 'error', cache: 'no-store', headers: { 'User-Agent': AGENT, Accept: kind === 'json' ? 'application/json' : kind === 'zip' ? 'application/zip' : 'text/html' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok || r.redirected || r.url && r.url !== url) throw new Error(`business_source_http_${r.status}`);
  const type = r.headers.get('content-type') ?? '';
  if (kind === 'json' && !/json/i.test(type) || kind === 'html' && !/html|xml/i.test(type) || kind === 'zip' && !/zip|octet-stream/i.test(type)) throw new Error('business_source_type');
  const advertised = r.headers.get('content-length');
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > max)) { await r.body?.cancel(); throw new Error('business_source_size'); }
  const reader = r.body?.getReader(); if (!reader) throw new Error('business_source_empty');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const p = await reader.read(); if (p.done) break; size += p.value.length; if (size > max) throw new Error('business_source_size'); chunks.push(p.value); } }
  finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function json(url: string, d: SourceDependencies): Promise<unknown> { return JSON.parse(Buffer.from(await read(url, 'json', d)).toString('utf8')); }
export interface SecListing { symbol: string; issuerId: string; name: string }
export function parseSecDirectory(value: unknown): SecListing[] {
  if (!rec(value) || !Array.isArray(value.fields) || !Array.isArray(value.data) || value.data.length > 30000) throw new Error('sec_directory_invalid');
  const fields = value.fields; const at = (row: unknown[], field: string) => row[fields.indexOf(field)];
  if (!['cik', 'name', 'ticker', 'exchange'].every(f => fields.includes(f))) throw new Error('sec_directory_fields');
  return value.data.map(row => {
    if (!Array.isArray(row) || !Number.isSafeInteger(at(row, 'cik')) || Number(at(row, 'cik')) < 1
      || typeof at(row, 'ticker') !== 'string' || typeof at(row, 'name') !== 'string') throw new Error('sec_directory_row');
    return { symbol: String(at(row, 'ticker')), issuerId: String(at(row, 'cik')).padStart(10, '0'), name: String(at(row, 'name')) };
  });
}
export async function secDirectory(d = defaults()): Promise<SecListing[]> {
  return parseSecDirectory(await json('https://www.sec.gov/files/company_tickers_exchange.json', d));
}
/** No fuzzy name matching. A ticker mapping must also agree with the issuer's submissions. */
export async function collectSecBusiness(symbol: string, listings: SecListing[], d = defaults()): Promise<BusinessEvidence> {
  const matches = listings.filter(row => row.symbol === symbol);
  if (matches.length !== 1) throw new Error(matches.length ? 'issuer_ambiguous' : 'issuer_not_found');
  const listing = matches[0], identityUrl = `https://data.sec.gov/submissions/CIK${listing.issuerId}.json`;
  const metadata = await json(identityUrl, d);
  if (!rec(metadata) || String(metadata.cik).padStart(10, '0') !== listing.issuerId || !Array.isArray(metadata.tickers)
    || !metadata.tickers.includes(symbol) || !rec(metadata.filings) || !rec(metadata.filings.recent)) throw new Error('issuer_mapping_changed');
  const recent = metadata.filings.recent;
  const columns = ['form', 'accessionNumber', 'acceptanceDateTime', 'primaryDocument'];
  if (!columns.every(k => Array.isArray(recent[k])) || columns.some(k => (recent[k] as unknown[]).length !== (recent.form as unknown[]).length)) throw new Error('sec_business_columns');
  const rows = (recent.form as unknown[]).map((form, i) => ({ form, accession: (recent.accessionNumber as unknown[])[i], accepted: (recent.acceptanceDateTime as unknown[])[i], file: (recent.primaryDocument as unknown[])[i] }))
    .filter(r => ['10-K', '10-K/A', '20-F', '20-F/A'].includes(String(r.form))).sort((a, b) => String(b.accepted).localeCompare(String(a.accepted)));
  const filing = rows[0];
  if (!filing || typeof filing.accession !== 'string' || !/^\d{10}-\d{2}-\d{6}$/.test(filing.accession)
    || typeof filing.accepted !== 'string' || !Number.isFinite(Date.parse(filing.accepted))
    || typeof filing.file !== 'string' || !/^[A-Za-z0-9_.-]+\.html?$/.test(filing.file)) throw new Error('annual_filing_unavailable');
  // An amendment is not silently replaced with an older annual report when its business section is incomplete.
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(listing.issuerId)}/${filing.accession.replaceAll('-', '')}/${filing.file}`;
  const body = await read(url, 'html', d, BUSINESS_DOCUMENT_LIMIT); const now = d.now();
  const evidence: BusinessEvidence = { identity: { symbol, name: String(metadata.name ?? listing.name), market: 'US', provider: 'sec', issuerId: listing.issuerId, verifiedAt: now, identityUrl },
    documentId: filing.accession, url, title: `${listing.name} · ${filing.form} 사업보고서`, publishedAt: filing.accepted, retrievedAt: now, bodyHash: hash(Buffer.from(body).toString('utf8')), contentHash: businessDocumentContentHash(Buffer.from(body).toString('utf8')), passages: selectBusinessPassages(Buffer.from(body).toString('utf8')) };
  if (evidenceReasons(evidence, now).length) throw new Error('business_evidence_invalid');
  return evidence;
}
/** Evidence selection only; a keyword score never grants factual support or publication. */
export function selectBusinessPassages(html: string): BusinessEvidence['passages'] {
  const all = businessDocumentText(html);
  // First identify the business section. Risk-factor keyword density is not a business description.
  const start = /^(?:item\s*1[.\s:–-]*business(?: description)?|item\s*4[.\s:–-]*information on the company|(?:II|Ⅱ|2)[.\s]*사업의\s*내용)[.\s]*$/i;
  const end = /^(?:item\s*(?:1a|1b|1c|2|4a|5)\b|risk factors$|(?:III|Ⅲ|3)[.\s]*재무에\s*관한\s*사항)/i;
  const sections: {text:string;index:number}[][] = [];
  for (let at=0;at<all.length;at++) {
    const joined=all[at]+' '+(all[at+1]??'');
    if (!start.test(all[at].trim()) && !start.test(joined.trim())) continue;
    let until=at+1; while(until<all.length&&!end.test(all[until].trim()))until++;
    const section=all.slice(at+1,until).map((text,i)=>({text,index:at+1+i})).filter(p=>p.text.length>=80);
    if(section.reduce((n,p)=>n+p.text.length,0)>=300)sections.push(section);
  }
  const paragraphs=sections.sort((a,b)=>b.reduce((n,p)=>n+p.text.length,0)-a.reduce((n,p)=>n+p.text.length,0))[0];
  if(!paragraphs)throw new Error('business_section_unconfirmed');
  const unique = [...new Map(paragraphs.map(p => [p.text, p])).values()];
  const scored = unique.map(({text,index}) => ({ text, index,
    score: (text.match(/\b(?:customers?|members?|subscribers?|subscription|fees?|commissions?|transactions?|hosts?|guests?|services?|products?|business|revenue|platform|manufactur\w*|license|advertis\w*)\b|사업|고객|구독|수수료|매출|제품|서비스|생산|판매|광고/gi) ?? []).length }));
  // Keyword-dense product/closure paragraphs must not crowd out the actual
  // company overview. Keep the beginning of the confirmed business section.
  const overview = unique.filter(p => p.text.length <= 2400 && !/^\d{1,2}\s/.test(p.text)).slice(0, 3);
  const openingIds = new Set(overview.map(p => p.index));
  const selected = [...overview, ...scored.filter(p => !openingIds.has(p.index) && p.score >= 2 && p.text.length <= 2400)
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 12 - overview.length)].sort((a, b) => a.index - b.index);
  const result: BusinessEvidence['passages'] = []; let size = 0;
  for (const p of selected) { if (size + p.text.length > 18000) continue; size += p.text.length; result.push({ id: `p${p.index}`, text: p.text, hash: hash(p.text), role: p.index === overview[0]?.index ? 'overview' : 'detail' }); }
  if (result.length < 2) throw new Error('business_passages_insufficient');
  return result;
}
/** Inspect uncompressed sizes before invoking unzip; ZIP metadata cannot authorize unbounded allocation. */
export function boundedZip(bytes: Uint8Array, max = 40_000_000): Record<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let declared = 0, count = 0;
  for (let at = 0; at + 46 <= bytes.length; at++) if (view.getUint32(at, true) === 0x02014b50) {
    const size = view.getUint32(at + 24, true), nameLen = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    if (size === 0xffffffff || at + 46 + nameLen + extra + comment > bytes.length || ++count > 20 || (declared += size) > max) throw new Error('dart_zip_limit');
    at += 45 + nameLen + extra + comment;
  }
  if (!count) throw new Error('dart_zip_invalid');
  const files = unzipSync(bytes, { filter: file => file.originalSize <= max && !file.name.includes('..') && /\.(xml|html?)$/i.test(file.name) });
  if (Object.keys(files).length > 20 || Object.values(files).reduce((n, b) => n + b.length, 0) > max) throw new Error('dart_zip_limit');
  return files;
}
export interface DartListing { symbol: string; issuerId: string; name: string }
export function parseDartDirectory(xml: string): DartListing[] {
  const rows: DartListing[] = [];
  for (const m of xml.matchAll(/<list>([^]*?)<\/list>/g)) {
    const field = (name: string) => m[1].match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim();
    const symbol = field('stock_code'), issuerId = field('corp_code'), name = field('corp_name');
    if (symbol && /^[A-Z0-9]{6}$/.test(symbol)) { if (!issuerId || !/^\d{8}$/.test(issuerId) || !name) throw new Error('dart_directory_row'); rows.push({ symbol, issuerId, name }); }
  }
  if (!rows.length) throw new Error('dart_directory_empty'); return rows;
}
function dartUrl(path: string, key: string, params: Record<string, string> = {}): string {
  if (!/^[a-f0-9]{40}$/i.test(key)) throw new Error('dart_not_configured');
  return `https://opendart.fss.or.kr/api/${path}?${new URLSearchParams({ crtfc_key: key, ...params })}`;
}
export async function dartDirectory(key: string, d = defaults()): Promise<DartListing[]> {
  const files = boundedZip(await read(dartUrl('corpCode.xml', key), 'zip', d, 15_000_000));
  const xml = files['CORPCODE.xml']; if (!xml) throw new Error('dart_directory_file'); return parseDartDirectory(Buffer.from(xml).toString('utf8'));
}
export async function collectDartBusiness(symbol: string, listings: DartListing[], key: string, d = defaults()): Promise<BusinessEvidence> {
  const code = symbol.replace(/\.(KS|KQ)$/, ''), matches = listings.filter(r => r.symbol === code);
  if (matches.length !== 1) throw new Error(matches.length ? 'issuer_ambiguous' : 'issuer_not_found');
  const identity = matches[0]; const company = await json(dartUrl('company.json', key, { corp_code: identity.issuerId }), d);
  if (!rec(company) || company.status !== '000' || company.corp_code !== identity.issuerId || company.stock_code !== code) throw new Error('issuer_mapping_changed');
  const begin = new Date(Date.parse(d.now()) - 550 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
  const list = await json(dartUrl('list.json', key, { corp_code: identity.issuerId, bgn_de: begin, pblntf_detail_ty: 'A001', last_reprt_at: 'Y', page_count: '100' }), d);
  if (!rec(list) || list.status !== '000' || !Array.isArray(list.list)) throw new Error('annual_filing_unavailable');
  const filing = list.list.filter(rec).filter(r => r.corp_code === identity.issuerId && typeof r.report_nm === 'string' && /사업보고서/.test(r.report_nm)).sort((a, b) => String(b.rcept_no).localeCompare(String(a.rcept_no)))[0];
  if (!filing || !/^\d{14}$/.test(String(filing.rcept_no)) || !/^\d{8}$/.test(String(filing.rcept_dt))) throw new Error('annual_filing_unavailable');
  const files = boundedZip(await read(dartUrl('document.xml', key, { rcept_no: String(filing.rcept_no) }), 'zip', d));
  const main = files[`${filing.rcept_no}.xml`]; if (!main) throw new Error('dart_document_identity_unconfirmed');
  const now = d.now(), day = String(filing.rcept_dt), publishedAt = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00+09:00`;
  const e: BusinessEvidence = { identity: { symbol, name: identity.name, market: 'KR', provider: 'dart', issuerId: identity.issuerId, verifiedAt: now, identityUrl: `https://opendart.fss.or.kr/api/company.json?corp_code=${identity.issuerId}` },
    documentId: String(filing.rcept_no), url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${filing.rcept_no}`, title: `${identity.name} · ${filing.report_nm}`, publishedAt, retrievedAt: now, bodyHash: hash(Buffer.from(main).toString('utf8')), contentHash: businessDocumentContentHash(Buffer.from(main).toString('utf8')), passages: selectBusinessPassages(Buffer.from(main).toString('utf8')) };
  if (evidenceReasons(e, now).length) throw new Error('business_evidence_invalid'); return e;
}
