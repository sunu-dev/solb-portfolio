import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { hash, evidenceHash, validateDraft, validateReview, publicProjection, evidenceReasons } from '@/lib/companyBusiness/validation';
import { BUSINESS_FIELDS, BUSINESS_POLICY, type BusinessEvidence, type BusinessDraft, type BusinessReview, type BusinessSnapshot, type BusinessPort } from '@/lib/companyBusiness/types';
import { runBusinessCycle } from '@/lib/companyBusiness/cycle';
import { parseSecDirectory, parseDartDirectory, collectSecBusiness, selectBusinessPassages, boundedZip, businessDocumentContentHash } from '@/lib/companyBusiness/sources';
import { zipSync, strToU8 } from 'fflate';
import { businessMarket } from '@/lib/companyBusiness/market';
const now = '2026-11-01T00:00:00Z';
const passage = 'Our customers use our software services to manage their business operations. We earn revenue from subscriptions to these products and support services. Service delivery costs affect profitability.';
function evidence(): BusinessEvidence { return { identity: { symbol: 'TEST', name: 'Test Corporation', provider: 'sec', market: 'US', issuerId: '0000000123', verifiedAt: now, identityUrl: 'https://data.sec.gov/submissions/CIK0000000123.json' }, documentId: '0000000123-26-000001', url: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000001/report.htm', title: 'Test Corporation · annual report', publishedAt: '2026-02-01T00:00:00Z', retrievedAt: now, bodyHash: hash('html'), passages: [{ id: 'p1', text: passage, hash: hash(passage) }, { id: 'p2', text: 'We provide products and services to business customers through annual subscriptions and enterprise support contracts.', hash: hash('We provide products and services to business customers through annual subscriptions and enterprise support contracts.') }] }; }
function draft(e = evidence()): BusinessDraft { const texts = {
 summary: '기업이 업무 정보를 관리하는 데 쓰는 소프트웨어와 지원 서비스를 제공하는 회사예요.',
 customers: '업무 정보를 관리해야 하는 기업이 고객이에요. 서비스를 이용해 조직의 업무를 운영해요.',
 revenue: '기업 고객이 소프트웨어를 쓰기 위해 내는 구독료와 지원 서비스 비용에서 매출을 얻어요.',
 watch: '구독 서비스 매출과 서비스를 제공하는 비용을 함께 살펴보세요. 매출 증가만으로 이익을 판단하지 않아요.',
}; return { policy: BUSINESS_POLICY, symbol: e.identity.symbol, evidenceHash: evidenceHash(e), sections: Object.fromEntries(BUSINESS_FIELDS.map(field => [field, { text: texts[field], citations: [{ passageId: 'p1', quote: passage }] }])) as BusinessDraft['sections'] }; }
function review(d = draft(), e = evidence()): BusinessReview { return { policy: BUSINESS_POLICY, draftHash: hash(d), evidenceHash: evidenceHash(e), identityMatches: true, noUnsupportedClaims: true, checks: BUSINESS_FIELDS.map(field => ({ field, supported: true, complete: true, beginnerFriendly: true, issue: '' })) }; }
describe('business trust boundaries', () => {
 it('blocks mixed-script names, unqualified rankings and long promotional summaries',()=>{
  for(const text of ['카వంటి는 소비자와 판매점을 연결해 자동차를 사고팔 수 있도록 돕는 플랫폼이에요.','미국에서 가장 많이 방문되는 자동차 플랫폼으로 최고 수준의 서비스를 제공하는 회사예요.','회사의 사업을 장황하게 설명합니다. '.repeat(20)]){
   const e=evidence(),d=draft(e);d.sections.summary.text=text;expect(validateDraft(d,e,now).draft).toBeNull();
  }
 });
 it('preserves source, draft and review binding after JSONB-style key reordering',()=>{
  const e=evidence(),d=draft(e),r=review(d,e);
  const reorder=(v:unknown):unknown=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
  const stored=JSON.parse(JSON.stringify(reorder({e,d,r})));
  expect(hash(stored.d)).toBe(hash(d));expect(evidenceHash(stored.e)).toBe(evidenceHash(e));
  expect(publicProjection(stored.e,stored.d,stored.r,now).version).toBe(hash(d));
  stored.d.sections.summary.text+=' 변경';expect(hash(stored.d)).not.toBe(hash(d));
 });
 it('requires the company introduction instead of a perfectly quoted segment paragraph as the whole summary',()=>{
  const e=evidence();e.passages[0].role='overview';e.passages[1].role='detail';const d=draft(e);
  d.sections.summary.citations=[{passageId:'p2',quote:e.passages[1].text}];
  expect(validateDraft(d,e,now).reasons).toContain('summary_overview_required');
 });
 it('accepts bounded sourced content and projects only user-facing facts', () => { const e=evidence(),d=draft(e),r=review(d,e); expect(validateDraft(d,e,now).reasons).toEqual([]); const p=publicProjection(e,d,r,now);expect(p.sources[0].url).toBe(e.url);expect(p).not.toHaveProperty('passages');expect(p).not.toHaveProperty('checks'); });
 it('rejects wrong issuer URL, future/stale sources and tampered passages', () => { const e=evidence();e.url=e.url.replace('/123/','/456/');expect(evidenceReasons(e,now)).toContain('source_identity_mismatch'); e.url=evidence().url;e.publishedAt='2027-01-01';expect(evidenceReasons(e,now)).toContain('source_period_invalid');e.publishedAt='2023-01-01';expect(evidenceReasons(e,now)).toContain('source_period_invalid');e.passages[0].text+=' changed';expect(evidenceReasons(e,now)).toContain('invalid_passages'); });
 it.each(['summary','customers','revenue','watch'] as const)('rejects ungrounded or fabricated %s', field => { const e=evidence(),d=draft(e);d.sections[field].citations[0].quote='this passage does not exist in the report';expect(validateDraft(d,e,now).draft).toBeNull();d.sections[field].citations=[];expect(validateDraft(d,e,now).draft).toBeNull();d.sections[field].text='실제 이익이 10% 늘었지만 시장의 기대에는 못 미쳤다고 설명하는 회사예요.';expect(validateDraft(d,e,now).draft).toBeNull(); });
 it('rejects a review copied from a different draft or with missing, repeated or failed checks', () => { const e=evidence(),d=draft(e);const r=review(d,e);d.sections.summary.text+=' 다른 제품도 있어요.';expect(validateReview(r,d,e).review).toBeNull(); const failed=review(d,e);failed.checks[1].supported=false;expect(validateReview(failed,d,e).review).toBeNull();const repeated=review(d,e);repeated.checks[1]=repeated.checks[0];expect(validateReview(repeated,d,e).review).toBeNull(); });
 it('does not change the evidence fingerprint just to update last seen', () => { const e=evidence(),other=structuredClone(e);other.retrievedAt='2026-11-02T00:00:00Z';other.identity.verifiedAt=other.retrievedAt;expect(evidenceHash(other)).toBe(evidenceHash(e));other.bodyHash=hash('changed');expect(evidenceHash(other)).not.toBe(evidenceHash(e)); });
});
function harness(snapshot: BusinessSnapshot={evidence:null,draft:null,review:null}) { let saved=structuredClone(snapshot);const checkpoints: string[]=[]; const port: BusinessPort={claim:async owner=>({symbol:'TEST',owner,fence:1,snapshot:saved}),checkpoint:async(_job,next,state)=>{saved=structuredClone(next);checkpoints.push(state);return true;}}; const model={draft:vi.fn(async()=>draft()),review:vi.fn(async()=>review())};return {port,model,checkpoints,saved:()=>saved}; }
describe('resumable business cycle',()=>{
 it('keeps a bound rejection and revises the draft on the next attempt before a fresh review',async()=>{
  const h=harness(),bad=review();bad.checks[0]={field:'summary',supported:false,complete:false,beginnerFriendly:false,issue:'제련소를 판매하는 제품처럼 서술했으므로 알루미나와 알루미늄의 관계를 바로잡아야 합니다.'};
  h.model.review.mockResolvedValueOnce(bad);
  expect((await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now})).status).toBe('held');
  expect(h.saved().review).toBeNull();expect(h.saved().repair?.feedback?.checks[0].issue).toContain('제련소');
  const next=harness(h.saved()),changed=draft();changed.sections.summary.text='기업이 업무 정보를 모으고 관리하는 소프트웨어를 제공하고, 구독 고객의 이용을 지원하는 회사예요.';
  next.model.draft.mockResolvedValueOnce(changed);next.model.review.mockResolvedValueOnce(review(changed));
  expect((await runBusinessCycle({owner:randomUUID(),port:next.port,collect:async()=>evidence(),model:()=>next.model,now:()=>now})).status).toBe('approval_pending');
  expect(next.model.draft).toHaveBeenCalledWith(expect.any(String),expect.any(Object),{draft:draft(),feedback:bad});
  expect(next.saved().repair).toEqual({attempts:1,feedback:null});
  expect(next.saved().review?.draftHash).toBe(hash(changed));
 });
 it('caps semantic repairs and rejects feedback bound to a different draft without model calls',async()=>{
  const rejected=review();rejected.checks[1].supported=false;rejected.checks[1].issue='고객 범위를 잘못 일반화했습니다.';
  for (const [attempts,wrongHash,reason] of [[2,false,'business_repair_limit'],[0,true,'business_repair_binding_invalid']] as const) {
   const feedback=structuredClone(rejected);if(wrongHash)feedback.draftHash=hash('another draft');
   const h=harness({evidence:evidence(),draft:draft(),review:null,repair:{attempts,feedback}});
   const result=await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now});
   expect(result.reason).toBe(reason);expect(h.model.draft).not.toHaveBeenCalled();expect(h.model.review).not.toHaveBeenCalled();
  }
 });
 it('checks source, checkpoints draft, independently reviews and never self-publishes',async()=>{const h=harness();const result=await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now});expect(result.status).toBe('approval_pending');expect(h.checkpoints).toEqual(['collecting','review_pending','approval_pending']);});
 it('persists a successful draft across review outage and resumes without regenerating',async()=>{const h=harness();h.model.review.mockRejectedValueOnce(new Error('provider_timeout'));await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now});expect(h.saved().draft).not.toBeNull();const resumed=harness(h.saved());expect((await runBusinessCycle({owner:randomUUID(),port:resumed.port,collect:async()=>evidence(),model:()=>resumed.model,now:()=>now})).status).toBe('approval_pending');expect(resumed.model.draft).not.toHaveBeenCalled();});
 it('does no model work for unchanged reviewed evidence',async()=>{const h=harness({evidence:evidence(),draft:draft(),review:review()});expect((await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now})).status).toBe('unchanged');expect(h.model.draft).not.toHaveBeenCalled();expect(h.model.review).not.toHaveBeenCalled();expect(h.checkpoints).toEqual(['approval_pending']);});
 it('preserves the reviewed draft without model calls when only delivery scripts changed',async()=>{
  const e=evidence();e.contentHash=hash('unchanged full filing without scripts');
  const d=draft(e),r=review(d,e),h=harness({evidence:e,draft:d,review:r});
  const refreshed={...e,bodyHash:hash('same filing with a rotated script URL')};
  const result=await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>refreshed,model:()=>h.model,now:()=>now});
  expect(result.status).toBe('unchanged');expect(h.saved().draft).toEqual(d);expect(h.saved().review).toEqual(r);
  expect(h.saved().evidence?.bodyHash).toBe(refreshed.bodyHash);
  expect(h.model.draft).not.toHaveBeenCalled();expect(h.model.review).not.toHaveBeenCalled();
 });
 it('stops before spending when a newer worker has taken over',async()=>{const h=harness();h.port.checkpoint=async()=>false;expect((await runBusinessCycle({owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now})).status).toBe('stale_worker');expect(h.model.draft).not.toHaveBeenCalled();});
 it('holds budget errors rather than bypassing them and redacts arbitrary provider messages',async()=>{const h=harness();h.model.draft.mockRejectedValueOnce(new Error('business_model_blocked_limit_reached'));const input={owner:randomUUID(),port:h.port,collect:async()=>evidence(),model:()=>h.model,now:()=>now};expect((await runBusinessCycle(input)).reason).toBe('business_model_blocked_limit_reached');h.model.draft.mockRejectedValueOnce(new Error('https://provider.invalid?key=secret'));expect((await runBusinessCycle(input)).reason).toBe('business_attempt_failed');});
});
describe('official source discovery',()=>{
 it('ignores rotating delivery scripts but detects changes anywhere else in the filing',()=>{
  const report=`<h1>Item 1. Business</h1><p>${passage}</p><p>Uncited business context.</p>`;
  const a=report+'<script src="/delivery-one"></script>',b=report+'<script src="/delivery-two">window.delivery=2;</script>';
  expect(hash(a)).not.toBe(hash(b));
  expect(businessDocumentContentHash(a)).toBe(businessDocumentContentHash(b));
  expect(businessDocumentContentHash(a)).not.toBe(businessDocumentContentHash(a.replace('Uncited business context.','The business discontinued a major service.')));
  const e=evidence();e.contentHash=businessDocumentContentHash(a);
  const other={...e,bodyHash:hash(b)};
  expect(evidenceHash(other)).toBe(evidenceHash(e));
  other.contentHash=businessDocumentContentHash(b+'<p>Changed business facts.</p>');
  expect(evidenceHash(other)).not.toBe(evidenceHash(e));
 });
 it('keeps the low-keyword main business introduction even when detailed products dominate keyword scores',()=>{
  const intro='We connect people who are looking for a car with sellers through our online marketplace. Buyers compare the available cars before contacting a seller.';
  const details=Array.from({length:15},(_,i)=>`<p>Product ${i}: our customers use subscription services and business services. These customers pay fees for products and services; revenue includes subscription fees from business customers.</p>`).join('');
  const selected=selectBusinessPassages(`<h1>Item 1. Business</h1><p>${intro}</p><p>1 Source note about third-party website audience comparisons, collected during the prior year for management research.</p>${details}<h2>Item 1A. Risk Factors</h2>`);
  expect(selected).toHaveLength(12);expect(selected.find(p=>p.role==='overview')?.text).toBe(intro);
  expect(selected.filter(p=>p.role==='overview')).toHaveLength(1);
 });
 it('maps exact SEC ticker and DART stock code without fuzzy company-name joins',()=>{expect(parseSecDirectory({fields:['cik','name','ticker','exchange'],data:[[123,'Test','TEST','NYSE']]})).toEqual([{symbol:'TEST',issuerId:'0000000123',name:'Test'}]);expect(parseDartDirectory('<result><list><corp_code>00123456</corp_code><corp_name>테스트</corp_name><stock_code>123456</stock_code></list></result>')[0].issuerId).toBe('00123456');});
 it('refuses ambiguous mappings before any request',async()=>{const transport=vi.fn();const row={symbol:'TEST',name:'Test',issuerId:'0000000123'};await expect(collectSecBusiness('TEST',[row,row],{transport,now:()=>now,pause:async()=>{}})).rejects.toThrow('issuer_ambiguous');expect(transport).not.toHaveBeenCalled();});
 it('requires a second ticker/issuer match and never follows arbitrary primary-document paths',async()=>{const transport=vi.fn(async()=>Response.json({cik:123,tickers:['DIFFERENT'],filings:{recent:{}}}));await expect(collectSecBusiness('TEST',[{symbol:'TEST',name:'Test',issuerId:'0000000123'}],{transport,now:()=>now,pause:async()=>{}})).rejects.toThrow('issuer_mapping_changed');});
 it('selects visible business prose, excluding scripts and hidden text and deduplicating layout copies',()=>{const p=selectBusinessPassages(`<h1>Item 1. Business</h1><script>${passage}</script><div hidden>${passage}</div><table><tr><td>${passage}</td></tr></table><p>${passage}</p><p>Our products and subscription services provide software for customers who manage business operations in multiple offices. These enterprise customers subscribe to use the platform and receive support for their everyday business.</p><h2>Item 1A. Risk Factors</h2>`);expect(p).toHaveLength(2);expect(p.map(x=>x.text).join(' ')).not.toContain('<script>');});
 it('recognizes table-based annual-report headings and trailing punctuation without swallowing risk factors',()=>{const p=selectBusinessPassages(`<table><tr><td>ITEM&#160;1.</td><td>BUSINESS.</td></tr></table><p>${passage}</p><p>Our products and subscription services provide software for customers who manage business operations in multiple offices. These enterprise customers subscribe to use the platform and receive support for their everyday business.</p><table><tr><td>ITEM 1A.</td><td>RISK FACTORS</td></tr></table><p>We could lose customers if a hypothetical competitor enters the business and our revenue from subscription services falls unexpectedly in the future.</p>`);expect(p).toHaveLength(2);expect(p.map(x=>x.text).join(' ')).not.toContain('hypothetical');});
 it('routes alphanumeric Korean stock codes to DART and keeps US tickers separate',()=>{for(const s of ['0001A0.KQ','0030R0.KS','00088K.KS','0001A0','005930'])expect(businessMarket(s)).toBe('KR');for(const s of ['MSFT','BRK-B','AAPL'])expect(businessMarket(s)).toBe('US');const rows=parseDartDirectory('<result><list><corp_code>00123456</corp_code><corp_name>테스트</corp_name><stock_code>0001A0</stock_code></list></result>');expect(rows[0].symbol).toBe('0001A0');});
 it('continues after self-closing hidden cells in real filing layouts',()=>{const p=selectBusinessPassages(`<h1>Item 1. Business</h1><table><tr><td style="display:none"/></tr></table><input hidden><p>${passage}</p><p>Our products and subscription services provide software for customers who manage business operations in multiple offices. These enterprise customers subscribe to use the platform and receive support for their everyday business.</p><h2>Item 1A. Risk Factors</h2>`);expect(p).toHaveLength(2);});
 it('does not replace the business section with hypothetical risks',()=>{expect(()=>selectBusinessPassages(`<h1>Item 1A. Risk Factors</h1><p>${passage}</p>`)).toThrow('business_section_unconfirmed');});
 it('bounds zip allocation and does not extract traversal entries',()=>{const good=zipSync({'CORPCODE.xml':strToU8('<result>test</result>')});expect(boundedZip(good)['CORPCODE.xml']).toBeDefined();expect(()=>boundedZip(good,2)).toThrow('dart_zip_limit');const traversal=zipSync({'../secret.xml':strToU8('test')});expect(Object.keys(boundedZip(traversal))).toEqual([]);});
});
