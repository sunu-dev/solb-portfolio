import { describe,it,expect } from 'vitest';
import { decimal,compareDecimal,documentHash,normalizeFact,instant } from '@/lib/marketCause/normalizeFacts';
import { evaluatePublication,parseCandidate } from '@/lib/marketCause/publicationPolicy';
import { extractSecConcept,parseSecFilings } from '@/lib/marketCause/sources/sec';
import { fetchSecJson } from '@/lib/marketCause/sources/secTransport';
import type {Context,FactInput,SourceDocument} from '@/lib/marketCause/types';
const context:Context={asOf:'2026-10-31T00:00:00Z',windowStart:'2026-10-29T00:00:00Z',entityIds:['CIK0000050863']};
function document(id='result',value='125.50'):SourceDocument {
 const cells={value};return {id,sourceId:'fixture-official',url:'https://example.com/release',hash:documentHash(cells),cells,
 publishedAt:'2026-10-30T20:00:00Z',precision:'instant',firstSeenAt:'2026-10-30T20:01:00Z',retrievedAt:'2026-10-30T20:01:00Z',status:'active'};
}
function fact(doc:SourceDocument,overrides:Partial<FactInput>={}) {
 return normalizeFact({id:`fact:${doc.id}`,documentId:doc.id,locator:'value',entityId:context.entityIds[0],metric:'revenue',unit:'USD',rawValue:doc.cells.value,
 scale:6,periodStart:'2026-07-01',periodEnd:'2026-09-30',basis:'gaap',role:'actual',scope:'consolidated',definition:'fixture:revenue',...overrides},doc);
}
const resultDoc=document();const actual=fact(resultDoc);
const expectedDoc={...document('expected','130'),publishedAt:'2026-10-29T12:00:00Z',firstSeenAt:'2026-10-29T12:01:00Z',retrievedAt:'2026-10-29T12:01:00Z'};
const expected=fact(expectedDoc,{role:'consensus'});
const pair={context,documents:[resultDoc,expectedDoc],facts:[actual,expected],candidates:[{id:'comparison',kind:'versus_consensus',actualId:actual.id,expectedId:expected.id}]};
describe('market cause evidence policy',()=>{
 it('preserves precision beyond IEEE integer range and normalizes units without rounding',()=>{
  expect(decimal('9007199254740993.125',3)).toBe('9007199254740993125');
  expect(compareDecimal('9007199254740993','9007199254740992')).toBe(1);
  expect(compareDecimal('-0.001','0')).toBe(-1);expect(decimal('-0.000',9)).toBe('0');
  for(const raw of ['1e9','1,200','NaN','Infinity','１２','1 billion','--1','01','0x10']) expect(()=>decimal(raw)).toThrow();
 });
 it('normalizes and compares financial decimal values across scales',()=>{
  for(let n=-100;n<=100;n++) for(const scale of [0,3,6,8,9,12]) {
   const normalized=decimal(`${n}`,scale);expect(BigInt(normalized)).toBe(BigInt(n)*BigInt(10)**BigInt(scale));
   expect(compareDecimal(normalized,normalized)).toBe(0);
  }
 });
 it('rejects invalid or ambiguous timestamps',()=>{
  for(const value of ['2026-02-30T12:00:00Z','2026-10-30','2026-10-30T24:00:00Z','2026-10-30T12:00:00']) expect(Number.isNaN(instant(value))).toBe(true);
 });
 it('retains fact-only status even for a verified expectation comparison',()=>{
  const r=evaluatePublication(pair);expect(r.claims[0].text).toContain('낮아요');expect(r.disposition).toBe('facts_only');
  expect(r.reasonCodes).toContain('price_attribution_not_verified');
 });
 it('rejects future consensus and any expectation first discovered after the result',()=>{
  for(const changes of [{publishedAt:'2026-10-30T21:00:00Z',firstSeenAt:'2026-10-30T21:01:00Z',retrievedAt:'2026-10-30T21:01:00Z'},
   {firstSeenAt:'2026-10-30T21:01:00Z',retrievedAt:'2026-10-30T21:01:00Z'}, {precision:'day' as const,publishedAt:'2026-10-29'}]) {
    const r=evaluatePublication({...pair,documents:[resultDoc,{...expectedDoc,...changes}]});expect(r.claims).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain('not_prior_consensus');
  }
 });
 it('does not compare GAAP/adjusted, quarter/YTD, different definitions or entities',()=>{
  for(const changes of [{basis:'adjusted' as const},{periodStart:'2026-01-01'},{definition:'other'},{entityId:'another'},{unit:'KRW' as const}]) {
   const altered=fact(expectedDoc,{role:'consensus',...changes});
   expect(evaluatePublication({...pair,facts:[actual,altered]}).claims).toHaveLength(0);
  }
 });
 it('detects changed raw evidence or forged normalized value',()=>{
  const changed={...resultDoc,cells:{value:'500'}};
  expect(evaluatePublication({...pair,documents:[changed,expectedDoc]}).claims).toHaveLength(0);
  expect(evaluatePublication({...pair,facts:[{...actual,value:'900000000'},expected]}).claims).toHaveLength(0);
 });
 it('rejects sources first seen or fetched after the evaluation cutoff',()=>{
  expect(evaluatePublication({...pair,documents:[{...resultDoc,firstSeenAt:'2026-11-01T00:00:00Z'},expectedDoc]}).claims).toHaveLength(0);
 });
 it('never accepts model-supplied prose, URLs, approval checks or arbitrary causes',()=>{
  for(const payload of [{id:'x',kind:'cause',text:'Rates caused the crash'},
   {id:'x',kind:'fact',factId:actual.id,text:'Invented!'}, {id:'x',kind:'fact',factId:actual.id,approved:true},
   {id:'x',kind:'mechanism',rule:'invented',factIds:[actual.id]}]) expect(parseCandidate(payload)).toBeNull();
 });
 it('withholds conflicting actual values instead of choosing a convenient source',()=>{
  const other=document('other','100');const r=evaluatePublication({...pair,documents:[...pair.documents,other],facts:[...pair.facts,fact(other)]});
  expect(r.disposition).toBe('conflicting');expect(r.claims).toHaveLength(0);
 });
 it('does not count duplicate evidence as independent and rejects duplicate IDs',()=>{
  expect(evaluatePublication({...pair,facts:[...pair.facts,actual]}).reasonCodes).toContain('duplicate_evidence_id');
  expect(evaluatePublication({...pair,candidates:[...pair.candidates,...pair.candidates]}).reasonCodes).toContain('duplicate_claim_id');
 });
 it('withdraws an existing explanation immediately when a source is missing or superseded',()=>{
  for(const docs of [[expectedDoc],[{...resultDoc,status:'superseded' as const},expectedDoc], [{...resultDoc,cells:{value:'tampered'}},expectedDoc]]) {
   const r=evaluatePublication({...pair,documents:docs,previousDocumentIds:[resultDoc.id]});expect(r.disposition).toBe('withdrawn');expect(r.claims).toEqual([]);
  }
 });
 it('allows a generic mechanism but never asserts price causation or negative capex',()=>{
  const f=fact(resultDoc,{metric:'capital_expenditure'});const candidates=[{id:'m',kind:'mechanism',rule:'capital_spending_cash',factIds:[f.id]}];
  const r=evaluatePublication({context,documents:[resultDoc],facts:[f],candidates});expect(r.claims[0].interpretation).toBe(true);expect(r.disposition).toBe('facts_only');
  const doc=document('negative','-100');expect(evaluatePublication({context,documents:[doc],facts:[fact(doc,{metric:'capital_expenditure'})],candidates:[{...candidates[0],factIds:['fact:negative']}]}).claims).toEqual([]);
 });
});
const cik='0000050863', accession='0000050863-26-000100';
const filing={accession,acceptedAt:'2026-10-30T20:00:00Z',filed:'2026-10-30',form:'10-Q'};
const row={accn:accession,start:'2026-01-01',end:'2026-09-30',val:100000000,filed:'2026-10-30',form:'10-Q',fp:'Q3',frame:'CY2026Q3'};
const extraction={cik,concept:'Revenues' as const,filings:[filing],firstSeenAt:'2026-10-30T20:01:00Z',retrievedAt:'2026-10-30T20:01:00Z'};
const body=(rows:unknown[])=>({cik:50863,taxonomy:'us-gaap',tag:'Revenues',units:{USD:rows}});
describe('SEC official structured adapter',()=>{
 it('joins accession metadata, preserves exact YTD instead of treating fp=Q3 as a quarter',()=>{
  const r=extractSecConcept({...extraction,body:body([row,row])});expect(r.facts).toHaveLength(1);expect(r.facts[0].periodStart).toBe('2026-01-01');
  expect(r.documents[0].publishedAt).toBe(filing.acceptedAt);expect(r.facts[0].role).toBe('actual');
 });
 it('blocks mismatched identities and taxonomy',()=>{
  for(const patch of [{cik:1},{tag:'NetIncomeLoss'},{taxonomy:'custom'}]) expect(()=>extractSecConcept({...extraction,body:{...body([row]),...patch}})).toThrow();
 });
 it('rejects unsafe precision, unknown accession, mismatched form and future availability',()=>{
  const r=extractSecConcept({...extraction,body:body([{...row,val:9007199254740992},{...row,accn:'missing'},{...row,form:'10-K'}, {...row,start:'2026-02-30'}])});
  expect(r.rejected).toBe(4);expect(r.facts).toEqual([]);
  expect(extractSecConcept({...extraction,body:body([row]),firstSeenAt:'2026-10-30T19:00:00Z'}).facts).toEqual([]);
 });
 it('rejects SEC parallel column mismatch and repeated accession metadata',()=>{
  const recent={accessionNumber:[accession],acceptanceDateTime:[filing.acceptedAt],filingDate:[filing.filed],form:[filing.form]};
  expect(parseSecFilings({cik:'50863',filings:{recent}},cik)).toEqual([filing]);
  expect(()=>parseSecFilings({cik:'50863',filings:{recent:{...recent,form:[]}}},cik)).toThrow();
 });
 it('fetches only fixed SEC paths with no redirects and bounded JSON',async()=>{
  let seen='';const transport:typeof fetch=async(url,init)=>{seen=String(url);expect(init?.redirect).toBe('error');return new Response(JSON.stringify(body([row])),{headers:{'content-type':'application/json'}});};
  const result=await fetchSecJson({cik,concept:'Revenues'},'Joobi/1.0 tests@example.com',transport);expect(seen).toContain('/companyconcept/CIK0000050863/');expect(result).toEqual(body([row]));
  await expect(fetchSecJson({cik:'https://127.0.0.1'},'Joobi/1.0 tests@example.com',transport)).rejects.toThrow();
  await expect(fetchSecJson({cik},'missing contact',transport)).rejects.toThrow();
  await expect(fetchSecJson({cik},'Joobi/1.0 tests@example.com',async()=>new Response('x',{headers:{'content-type':'text/html'}}))).rejects.toThrow('sec_content_type');
  await expect(fetchSecJson({cik},'Joobi/1.0 tests@example.com',async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'99999999'}}))).rejects.toThrow('sec_response_limit');
 });
});

// These callbacks simulate a provider boundary, not real model calls or a real budget DB.
import { budgetedAttempt,type BudgetPort } from '@/lib/marketCause/budgetedAttempt';
import { randomUUID } from 'node:crypto';
describe('budgeted external attempt',()=>{
 it('never calls a provider when reservation is denied or unavailable',async()=>{
  let calls=0;
  for(const status of ['disabled','limit_reached','already_reserved'] as const) {
   const budget:BudgetPort={reserve:async()=>({status}),settle:async()=>true};
   expect((await budgetedAttempt({key:'test',maxCost:100,budget,call:async()=>{calls++;return {value:'x',actualCost:1};}})).status).toBe('blocked');
  }
  expect(calls).toBe(0);
 });
 it('keeps unknown or failed calls reserved instead of marking them free',async()=>{
  let settled=0;const budget:BudgetPort={reserve:async()=>({status:'reserved',token:randomUUID()}),settle:async()=>{settled++;return true;}};
  expect(await budgetedAttempt({key:'test',maxCost:100,budget,call:async()=>{throw new Error('response lost');}})).toEqual({status:'unsettled',reason:'call_uncertain'});
  expect(await budgetedAttempt({key:'test2',maxCost:100,budget,call:async()=>({value:'x',actualCost:null})})).toEqual({status:'unsettled',reason:'cost_unknown'});
  expect(settled).toBe(0);
 });
 it('settles known cost before releasing a result and blocks underestimated calls',async()=>{
  const costs:number[]=[];const budget:BudgetPort={reserve:async()=>({status:'reserved',token:randomUUID()}),settle:async(_key,_token,cost)=>{costs.push(cost);return true;}};
  expect(await budgetedAttempt({key:'test',maxCost:100,budget,call:async()=>({value:'verified',actualCost:25})})).toEqual({status:'completed',value:'verified'});
  expect(await budgetedAttempt({key:'test2',maxCost:100,budget,call:async()=>({value:'not published',actualCost:101})})).toEqual({status:'blocked',reason:'reservation_exceeded'});
  expect(costs).toEqual([25,101]);
 });
});

import { reconcileDocuments,affectedReports } from '@/lib/marketCause/documentStore';
import { claimJob,finishJob,type JobState } from '@/lib/marketCause/jobState';
describe('correction and late worker boundaries',()=>{
 it('preserves first availability and keeps revoked sources revoked despite collector retry',()=>{
  const later={...resultDoc,firstSeenAt:'2026-10-30T22:00:00Z',retrievedAt:'2026-10-30T22:00:00Z'};
  const [doc]=reconcileDocuments([{...resultDoc,status:'withdrawn'}],[later]);
  expect(doc.firstSeenAt).toBe(resultDoc.firstSeenAt);expect(doc.status).toBe('withdrawn');expect(doc.retrievedAt).toBe(later.retrievedAt);
  expect(reconcileDocuments([doc],[])).toEqual([doc]);
 });
 it('requires a new version instead of rewriting evidence or earlier availability',()=>{
  expect(()=>reconcileDocuments([resultDoc],[{...resultDoc,publishedAt:'2026-10-30T19:00:00Z'}])).toThrow('immutable_document_changed');
  expect(()=>reconcileDocuments([resultDoc],[{...resultDoc,firstSeenAt:'2026-10-30T19:00:00Z'}])).toThrow('retroactive_availability');
 });
 it('locates all affected reports without withdrawing unrelated reports',()=>{
  expect(affectedReports([{versionId:'a',documentIds:['d1','d2'],disposition:'explained'},{versionId:'b',documentIds:['d2'],disposition:'facts_only'},
   {versionId:'c',documentIds:['d3'],disposition:'explained'}],['d2'])).toEqual(['a','b']);
 });
 it('fences a timed-out worker and caps retries',()=>{
  const initial:JobState={key:'job',inputHash:'input1',fence:0,leaseOwner:null,leaseUntil:null,attempts:0,status:'queued',resultHash:null};
  const first=claimJob(initial,'worker1','2026-10-31T00:00:00Z')!;
  expect(claimJob(first,'worker2','2026-10-31T00:00:01Z')).toBeNull();
  const second=claimJob(first,'worker2','2026-10-31T00:01:01Z')!;
  expect(finishJob(second,'worker1',first.fence,'input1',{},'2026-10-31T00:01:02Z')).toBeNull();
  expect(finishJob(second,'worker2',second.fence,'different-input',{},'2026-10-31T00:01:02Z')).toBeNull();
  expect(finishJob(second,'worker2',second.fence,'input1',{},'2026-10-31T00:01:02Z')?.status).toBe('finished');
  expect(claimJob(second,'worker3','2026-10-31T00:05:00Z')).toBeNull();
 });
});

import {runShadowCycle,type ShadowPort,type ShadowSnapshot} from '@/lib/marketCause/shadowCycle';
describe('shadow evidence cycle orchestration',()=>{
 it('acquires, verifies and stores facts without claiming automatic price explanation; unchanged retries skip',async()=>{
  let snapshot:ShadowSnapshot|undefined;let revision=0;let publishes=0;const done=new Set<string>();
  const port:ShadowPort={read:async()=>snapshot?{snapshot,revision}:null,
   claim:async key=>done.has(key)?{status:'finished'}:{status:'claimed',fence:1},
   publish:async input=>{expect(input.expectedRevision).toBe(revision);done.add(input.key);snapshot=input.snapshot;revision++;publishes++;return 'stored';}};
  const input={event:'us:CIK0000050863:2026-10-30',owner:'test',context,documents:[resultDoc],facts:[actual],port};
  expect(await runShadowCycle(input)).toEqual({status:'stored',disposition:'facts_only',claims:1});
  expect(await runShadowCycle({...input,documents:[{...resultDoc,retrievedAt:'2026-10-30T23:00:00Z'}]})).toEqual({status:'finished'});
  expect(publishes).toBe(1);
  expect(await runShadowCycle({...input,documents:[{...resultDoc,status:'withdrawn'}]})).toEqual({status:'stored',disposition:'withdrawn',claims:0});
 });
 it('re-evaluates when evidence becomes available after an earlier cutoff',async()=>{
  const done=new Set<string>();let snapshot:ShadowSnapshot|undefined;let revision=0;
  const port:ShadowPort={read:async()=>snapshot?{snapshot,revision}:null,
   claim:async key=>done.has(key)?{status:'finished'}:{status:'claimed',fence:1},
   publish:async input=>{done.add(input.key);snapshot=input.snapshot;revision++;return 'stored';}};
  const input={event:'us:available',owner:'test',context:{...context,asOf:'2026-10-30T19:00:00Z'},documents:[resultDoc],facts:[actual],port};
  expect((await runShadowCycle(input)).claims).toBe(0);
  expect((await runShadowCycle({...input,context})).claims).toBe(1);
 });
 it('does not publish if worker is off',async()=>{
  const port:ShadowPort={read:async()=>null,claim:async()=>({status:'disabled'}),publish:async()=>{throw new Error('must not call');}};
  expect(await runShadowCycle({event:'us:test',owner:'test',context,documents:[resultDoc],facts:[actual],port})).toEqual({status:'disabled'});
 });
});
