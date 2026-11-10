import {canonicalDigest} from '@/lib/marketCause/normalizeFacts';
import {describe,it,expect} from 'vitest';
import {extractProse,makeNarrative,eligiblePassages} from '@/lib/marketCause/narrativeEvidence';
import {makeNarrativePacket,parseHypotheses,selectValidHypotheses,assessNarratives} from '@/lib/marketCause/narrativeReview';
import {runNarrative} from '@/lib/marketCause/runNarrative';
import {estimateNarrativeCost} from '@/lib/marketCause/narrativeModel';
import type {Context} from '@/lib/marketCause/types';
const positive='We expect capital expenditures to increase as we expand data center capacity. This investment is intended to support future customer demand, while reducing cash available in the near term.';
const counter='Our cash generation remains uncertain and the planned expenditure could be reduced. We cannot assure that the increase in customer demand will continue throughout the next fiscal year.';
const context:Context={asOf:'2026-10-31T00:00:00Z',windowStart:'2026-10-29T00:00:00Z',entityIds:['CIK0000050863']};
const doc=makeNarrative({cik:'0000050863',accession:'0000050863-26-000100',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/ex99.htm',
 html:`<p>${positive}</p><p>${counter}</p>`,publishedAt:'2026-10-30T20:00:00Z',retrievedAt:'2026-10-30T20:01:00Z'});
const packet=makeNarrativePacket([doc],context);
const support=Object.keys(packet.passages).find(k=>packet.passages[k].text===positive)!;
const against=Object.keys(packet.passages).find(k=>packet.passages[k].text===counter)!;
const h={id:'h1',entityId:context.entityIds[0],summary:'회사는 고객 수요에 대응하기 위해 설비투자를 늘릴 계획이라고 밝혔어요.',pathway:'cash_investment',support:[support],counterEvidence:[]};
const draft={hypotheses:[h]};
function review(overrides:Record<string,unknown>={}, hs:unknown[]=[h]){return {inputHash:packet.inputHash,hypothesesHash:canonicalDigest(hs),reviewedPassages:Object.keys(packet.passages),reviews:[{id:'h1',verdict:'supported',sourceSupport:true,pathwaySupport:true,scopeCorrect:true,counterEvidence:[],counterResolutions:[],reason:'fixture review',...overrides}]};}
describe('narrative source boundaries',()=>{
 it('excludes scripts, tables and hidden facts rather than presenting them as prose',()=>{
  const html=`<script>${counter}</script><div hidden>${counter}</div><table><tr><td>${counter}</td></tr></table><p>${positive}</p>`;
  expect(extractProse(html)).toEqual([positive]);
 });
 it('handles nested hidden elements without leaking their text',()=>{
  expect(extractProse(`<div style="display:none"><div>${counter}</div>${counter}</div><p>${positive}</p>`)).toEqual([positive]);
 });
 it('decodes inline text without executing it and bounds input',()=>{
  expect(extractProse(`<p>${positive.replace('capital','<b>capital</b>')} &amp; cash.</p>`)[0]).toContain('capital expenditures');
  expect(()=>extractProse('x'.repeat(2_000_001))).toThrow();
 });
 it('rejects non-SEC, cross-company, traversal and future evidence',()=>{
  const base={cik:'0000050863',accession:'0000050863-26-000100',html:`<p>${positive}</p>`,publishedAt:'2026-10-30T20:00:00Z',retrievedAt:'2026-10-30T20:01:00Z'};
  for(const url of ['https://evil.test/x','https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/../secret.htm'])expect(()=>makeNarrative({...base,url})).toThrow();
  expect(eligiblePassages([doc],{...context,asOf:'2026-10-30T19:00:00Z'})).toEqual([]);
  expect(eligiblePassages([{...doc,status:'withdrawn'}],context)).toEqual([]);
 });
 it('rejects altered text and duplicate documents',()=>{
  expect(eligiblePassages([{...doc,cells:{...doc.cells,'paragraph:0':'changed'}}],context)).toEqual([]);
  expect(()=>eligiblePassages([doc,doc],context)).toThrow();
 });
 it('bounds reviewed passages and exposes omitted coverage',()=>{
  const many=makeNarrative({cik:'0000050863',accession:'0000050863-26-000101',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000101/ex99.htm',
   html:Array.from({length:40},(_,i)=>`<p>Section ${i}. ${positive}</p>`).join(''),publishedAt:doc.publishedAt!,retrievedAt:doc.retrievedAt});
  const p=makeNarrativePacket([many],context);expect(Object.keys(p.passages)).toHaveLength(30);expect(p.omitted).toBe(10);
 });
});
describe('hypotheses and adversarial review',()=>{
 it('discards an invalid sibling claim whole, with no rewriting or review bypass',async()=>{
  const mixed={hypotheses:[h,{...h,id:'h2',summary:'회사는 최근 5년 중 가장 높은 성장률을 기록했어요.'}]};
  expect(selectValidHypotheses(mixed,packet)).toEqual({hypotheses:[h],discardedCandidates:[{id:'h2',reason:'invalid_hypothesis'}]});
  const model={generate:async(key:string)=>key.endsWith(':draft')?mixed:review()};
  const result=await runNarrative({documents:[doc],context,model,attemptKey:'fixture'});
  expect(result.assessment?.hypotheses).toEqual([h]);expect(result.assessment?.discardedCandidates).toHaveLength(1);expect(result.publicEligible).toBe(false);
 });
 it('rejects ambiguous identities and an entirely invalid draft',()=>{
  expect(()=>selectValidHypotheses({hypotheses:[h,h]},packet)).toThrow('identity');
  expect(()=>selectValidHypotheses({hypotheses:[{...h,summary:'회사는 100% 증가했다고 밝혔어요.'}]},packet)).toThrow('invalid_hypothesis');
 });
 it('requires evidence-bound company summaries, excludes numeric prose and invented URLs',()=>{
  expect(parseHypotheses(draft,packet)).toHaveLength(1);
  for(const patch of [{summary:'매출이 30% 늘었어요.'},{entityId:'CIK0000000001'},{support:['p999']},{url:'https://evil.test'},
   {summary:'이 회사의 주가 하락 원인은 확실히 설비투자 때문이에요.'},{counterEvidence:[support]}])expect(()=>parseHypotheses({hypotheses:[{...h,...patch}]},packet)).toThrow();
 });
 it('rejects reviews that omit evidence, change packet identity or invent assessments',()=>{
  const hs=parseHypotheses(draft,packet);
  for(const patch of [{reviewedPassages:[support]},{inputHash:'old'},{reviews:[]},{approved:true}])expect(()=>assessNarratives(packet,hs,{...review(),...patch})).toThrow();
 });
 it('does not publish even a supported semantic judgment',()=>{
  const result=assessNarratives(packet,parseHypotheses(draft,packet),review());
  expect(result.status).toBe('shadow_supported');expect(result.publicEligible).toBe(false);
 });
 it('does not discard counterevidence in order to keep a convincing narrative',()=>{
  const result=assessNarratives(packet,parseHypotheses(draft,packet),review({counterEvidence:[against]}));
  expect(result.status).toBe('conflicting');expect(result.hypotheses).toEqual([]);
  expect(()=>assessNarratives(packet,parseHypotheses({hypotheses:[{...h,counterEvidence:[against]}]},packet),review({},[{...h,counterEvidence:[against]}]))).toThrow('incomplete_counter_resolution');
 });
 it('requires every independent check and rejects reviewer hallucinated references',()=>{
  for(const field of ['sourceSupport','pathwaySupport','scopeCorrect'])expect(assessNarratives(packet,parseHypotheses(draft,packet),review({[field]:false})).hypotheses).toEqual([]);
  expect(()=>assessNarratives(packet,parseHypotheses(draft,packet),review({counterEvidence:['p999']}))).toThrow();
 });
 it('runs separate draft and challenge stages with distinct reservation keys',async()=>{
  const calls:string[]=[];const model={generate:async(key:string)=>{calls.push(key);return calls.length===1?draft:review();}};
  const result=await runNarrative({documents:[doc],context,model,attemptKey:'fixture'});
  expect(result.status).toBe('reviewed');expect(calls).toHaveLength(2);expect(calls[0]).not.toBe(calls[1]);expect(result.publicEligible).toBe(false);
 });
 it('does not call a model without eligible evidence and does not retry malformed output',async()=>{
  let calls=0;const model={generate:async()=>{calls++;return {approved:true};}};
  expect((await runNarrative({documents:[],context,model,attemptKey:'fixture'})).status).toBe('no_evidence');expect(calls).toBe(0);
  expect((await runNarrative({documents:[doc],context,model,attemptKey:'fixture'})).status).toBe('failed');expect(calls).toBe(1);
 });
 it('meters known token usage conservatively and rejects missing or impossible counts',()=>{
  expect(estimateNarrativeCost(1000,1000)).toBe(500);
  expect(estimateNarrativeCost(1,1)).toBe(1);
  expect(estimateNarrativeCost(NaN,10)).toBeNull();expect(estimateNarrativeCost(-1,10)).toBeNull();
 });
});

import {exhibitNames} from '@/lib/marketCause/sources/secNarrative';
it('discovers named earnings releases by official exhibit type, rejecting cross-filing URLs',()=>{
 const prefix='https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/';
 const html=`<table><tr><td><a href="q326earningsrelease.htm">release</a></td><td>EX-99.1</td></tr>
 <tr><td><a href="https://evil.test/fake.htm">bad</a></td><td>EX-99.2</td></tr>
 <tr><td><a href="https://www.sec.gov/Archives/edgar/data/1/fake.htm">bad</a></td><td>EX-99.2</td></tr>
 <tr><td><a href="other.htm">not an exhibit</a></td><td>8-K</td></tr></table>`;
 expect(exhibitNames(html,prefix,new Set(['q326earningsrelease.htm','fake.htm','other.htm']))).toEqual(['q326earningsrelease.htm']);
});

it('requires explicit, exhaustive adjudication before dismissing draft counterevidence',()=>{
 const hs=parseHypotheses({hypotheses:[{...h,counterEvidence:[against]}]},packet);
 for(const relation of ['general_risk','unrelated'])expect(assessNarratives(packet,hs,review({counterResolutions:[{passageId:against,relation,reason:'This passage is not a contradiction of the reported plan.'}]},hs)).status).toBe('shadow_supported');
 expect(assessNarratives(packet,hs,review({counterResolutions:[{passageId:against,relation:'contradicts',reason:'The stated plan was cancelled.'}]},hs)).status).toBe('conflicting');
 for(const rows of [[],[{passageId:support,relation:'unrelated',reason:'wrong'}],[{passageId:against,relation:'unrelated',reason:''}]])expect(()=>assessNarratives(packet,hs,review({counterResolutions:rows},hs))).toThrow();
});

it('binds the review to the exact candidate text, including qualifiers',()=>{
 const changed=parseHypotheses({hypotheses:[{...h,summary:'회사는 생산시설 투자를 이미 완료했다고 밝혔어요.'}]},packet);
 expect(()=>assessNarratives(packet,changed,review())).toThrow('incomplete_narrative_review');
});
it('keeps packet and candidate fingerprints stable across database key order',()=>{
 const reorder=(v:unknown):unknown=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
 expect(makeNarrativePacket([reorder(doc) as typeof doc],reorder(context) as Context).inputHash).toBe(packet.inputHash);
 expect(assessNarratives(packet,parseHypotheses(reorder(draft),packet),review()).status).toBe('shadow_supported');
});


it('resumes a persisted draft after review failure without buying another draft',async()=>{
 let checkpoint: import('@/lib/marketCause/narrativeCheckpoint').NarrativeCheckpoint|undefined;
 const calls:string[]=[];
 const input={documents:[doc],context,attemptKey:'resume',now:()=>context.asOf,
  saveDraft:async(d:import('@/lib/marketCause/narrativeCheckpoint').NarrativeCheckpoint)=>{checkpoint=d;},
  model:{generate:async(key:string)=>{calls.push(key);if(key.endsWith(':draft'))return draft;throw new Error('narrative_budget_blocked');}}};
 expect((await runNarrative(input)).status).toBe('failed');expect(checkpoint).toBeDefined();
 const later={...context,asOf:'2026-10-31T01:00:00Z'};
 expect(makeNarrativePacket([doc],later).inputHash).toBe(packet.inputHash);
 const result=await runNarrative({...input,context:later,checkpoint,now:()=>later.asOf,model:{generate:async(key:string)=>{calls.push(key);return review();}}});
 expect(result.status).toBe('reviewed');expect(calls.filter(k=>k.endsWith(':draft'))).toHaveLength(1);
 expect(result.publicEligible).toBe(false);
});
it('invalidates a checkpoint after source changes, tampering, age or a new source window',async()=>{
 const {resumeDraft}=await import('@/lib/marketCause/narrativeCheckpoint');
 const checkpoint={policy:packet.version,inputHash:packet.inputHash,hypothesesHash:canonicalDigest([h]),createdAt:context.asOf,evidenceAsOf:context.asOf,hypotheses:parseHypotheses(draft,packet),discardedCandidates:[]};
 expect(resumeDraft(checkpoint,packet,context.asOf)).not.toBeNull();
 expect(resumeDraft({...checkpoint,hypotheses:[{...checkpoint.hypotheses[0],summary:'조작된 설명'}]},packet,context.asOf)).toBeNull();
 expect(resumeDraft(checkpoint,packet,'2026-11-02T00:00:00Z')).toBeNull();
 expect(resumeDraft(checkpoint,makeNarrativePacket([doc],{...context,windowStart:'2026-10-30T00:00:00Z'}),context.asOf)).toBeNull();
 expect(resumeDraft(checkpoint,makeNarrativePacket([{...doc,status:'withdrawn'}],context),context.asOf)).toBeNull();
});


it('registers real reviewed source bindings for independent review and flags altered decisions',async()=>{
 const {auditExplanationQuality}=await import('@/lib/marketCause/qualityAudit');
 const run=await runNarrative({documents:[doc],context,attemptKey:'audit',model:{generate:async(key:string)=>key.endsWith(':draft')?draft:review()}});
 const snapshot:import('@/lib/marketCause/shadowCycle').ShadowSnapshot={context,documents:[],facts:[],decision:{disposition:'facts_only',claims:[],rejected:[],reasonCodes:[],inputHash:'a'.repeat(64),policyVersion:'fixture'},narrative:{documents:[doc],run}};
 const head={event:'sec:INTC',version:crypto.randomUUID(),snapshot};
 const report=auditExplanationQuality([head],null,context.asOf);expect(report.cases).toHaveLength(1);
 expect(report.cases[0].developmentExposed).toBe(true);expect(report.report.independentlyReviewed).toBe(0);expect(report.report.faults).toEqual([]);
 const altered=structuredClone(head);altered.snapshot.narrative!.run.assessment!.status='conflicting';
 const invalid=auditExplanationQuality([altered],null,context.asOf);expect(invalid.cases).toEqual([]);expect(invalid.report.faults).toEqual(['invalid_narrative:INTC']);
});
