import {canonicalDigest} from '@/lib/marketCause/normalizeFacts';
import {describe,it,expect,vi} from 'vitest';
import {runShadowCycle,type ShadowPort,type ShadowSnapshot} from '@/lib/marketCause/shadowCycle';
import {makeNarrative} from '@/lib/marketCause/narrativeEvidence';
import {makeNarrativePacket} from '@/lib/marketCause/narrativeReview';
const context={asOf:'2026-10-31T00:00:00Z',windowStart:'2026-10-29T00:00:00Z',entityIds:['CIK0000050863']};
const document=makeNarrative({cik:'0000050863',accession:'0000050863-26-000100',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/ex99.htm',
 html:'<p>We plan to increase capital spending on manufacturing capacity. These investments are intended to meet customer demand while reducing near-term cash available to the company.</p>',publishedAt:'2026-10-30T20:00:00Z',retrievedAt:'2026-10-30T20:01:00Z'});
function setup(){
 const rows=new Map<string,{snapshot:ShadowSnapshot;revision:number}>(),events=new Map<string,string>(),done=new Set<string>();
 const publish=vi.fn<ShadowPort['publish']>(async input=>{const event=events.get(input.key)!;const prior=rows.get(event);if(input.expectedRevision!==(prior?.revision??0))return 'revision_conflict';rows.set(event,{snapshot:input.snapshot,revision:input.expectedRevision+1});done.add(input.key);return 'stored';});
 const port:ShadowPort={read:async event=>rows.get(event)??null,claim:async(key,event)=>{events.set(key,event);return done.has(key)?{status:'finished'}:{status:'claimed',fence:2};},publish};
 const packet=makeNarrativePacket([document],context);
 const hypothesis={id:'h1',entityId:context.entityIds[0],summary:'회사는 고객 수요에 대응하려고 생산시설 투자를 늘릴 계획이라고 밝혔어요.',pathway:'cash_investment',support:['p0'],counterEvidence:[]};
 const generate=vi.fn(async(key:string)=>key.endsWith(':draft')?{hypotheses:[hypothesis]}:
  {inputHash:packet.inputHash,hypothesesHash:canonicalDigest([hypothesis]),reviewedPassages:['p0'],reviews:[{id:'h1',verdict:'supported',sourceSupport:true,pathwaySupport:true,scopeCorrect:true,counterEvidence:[],counterResolutions:[],reason:'fixture'}]});
 const input={event:'us:INTC:2026-10-30',owner:'fixture',context,documents:[],facts:[],port,narrative:{documents:[document],model:{generate}}};
 return {input,generate,publish,get:()=>rows.get(input.event)?.snapshot};
}
describe('shadow narrative persistence boundaries',()=>{
 it('stores a reviewed private snapshot and deduplicates unchanged retrievals before spending',async()=>{
  const s=setup();expect((await runShadowCycle(s.input)).status).toBe('stored');
  expect(s.get()?.narrative?.run.assessment?.status).toBe('shadow_supported');expect(s.get()?.narrative?.run.publicEligible).toBe(false);
  expect(s.generate.mock.calls[0][0]).toMatch(/:2:.*:draft$/);
  expect((await runShadowCycle({...s.input,narrative:{...s.input.narrative,documents:[{...document,retrievedAt:'2026-10-30T23:00:00Z'}]}})).status).toBe('finished');
  expect(s.generate).toHaveBeenCalledTimes(2);expect(s.publish).toHaveBeenCalledTimes(2);
 });
 it('preserves the prior snapshot after a new-evidence model failure',async()=>{
  const s=setup();await runShadowCycle(s.input);const prior=s.get();s.generate.mockRejectedValue(new Error('provider unavailable'));
  const extra=makeNarrative({cik:'0000050863',accession:'0000050863-26-000101',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000101/ex99.htm',
   html:'<p>We are evaluating additional investment opportunities to support our longer-term capacity requirements and anticipate providing a further update later in the year.</p>',publishedAt:'2026-10-30T21:00:00Z',retrievedAt:'2026-10-30T21:01:00Z'});
  expect((await runShadowCycle({...s.input,narrative:{...s.input.narrative,documents:[document,extra]}})).status).toBe('analysis_failed');
  expect(s.get()).toBe(prior);expect(s.publish).toHaveBeenCalledTimes(2);
 });
 it('withdraws a revoked source without waiting for the model or allowing a late active fetch to restore it',async()=>{
  const s=setup();await runShadowCycle(s.input);s.generate.mockRejectedValue(new Error('must not call'));
  expect((await runShadowCycle({...s.input,narrative:{...s.input.narrative,documents:[{...document,status:'withdrawn'}]}})).disposition).toBe('withdrawn');
  expect(s.generate).toHaveBeenCalledTimes(2);expect(s.get()?.narrative?.run.assessment).toBeNull();
  expect((await runShadowCycle(s.input)).status).toBe('finished');expect(s.get()?.decision.disposition).toBe('withdrawn');
 });
 it('invalidates out-of-window explanations without generating a replacement',async()=>{
  const s=setup();await runShadowCycle(s.input);
  expect((await runShadowCycle({...s.input,context:{...context,windowStart:'2026-10-30T21:00:00Z'}})).disposition).toBe('withdrawn');
  expect(s.generate).toHaveBeenCalledTimes(2);
 });
 it('withdraws changed official text first and analyzes the replacement on a separate cycle',async()=>{
  const s=setup();await runShadowCycle(s.input);
  const changed=makeNarrative({cik:'0000050863',accession:'0000050863-26-000100',url:document.url,
   html:'<p>We have revised our capacity expansion plans following changes in customer requirements. Planned capital spending will now be reduced while we evaluate current demand.</p>',publishedAt:document.publishedAt!,retrievedAt:'2026-10-30T22:00:00Z'});
  const next={...s.input,narrative:{...s.input.narrative,documents:[changed]}};
  expect((await runShadowCycle(next)).disposition).toBe('withdrawn');expect(s.generate).toHaveBeenCalledTimes(2);
  s.generate.mockResolvedValue({hypotheses:[]});
  expect((await runShadowCycle(next)).status).toBe('stored');expect(s.generate).toHaveBeenCalledTimes(3);
  expect(s.get()?.narrative?.documents.find(d=>d.id===document.id)?.status).toBe('superseded');
  expect((await runShadowCycle(next)).status).toBe('finished');
 });
});
