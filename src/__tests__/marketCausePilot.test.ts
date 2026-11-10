import {describe,it,expect,vi} from 'vitest';
import {runSecShadowPilot} from '@/lib/marketCause/pilot';
import {makeNarrative} from '@/lib/marketCause/narrativeEvidence';
import type {ShadowPort,ShadowSnapshot} from '@/lib/marketCause/shadowCycle';
function setup(){
 const completed=new Set<string>();const rows=new Map<string,{revision:number;snapshot:ShadowSnapshot}>();const events=new Map<string,string>();
 const publish=vi.fn<ShadowPort['publish']>(async input=>{const event=events.get(input.key)!;const prior=rows.get(event);if((prior?.revision??0)!==input.expectedRevision)return 'revision_conflict';
  rows.set(event,{revision:input.expectedRevision+1,snapshot:input.snapshot});if(!input.retryable)completed.add(input.key);return 'stored';});
 const claim=vi.fn<ShadowPort['claim']>(async(key,event)=>{events.set(key,event);return completed.has(key)?{status:'finished'}:{status:'claimed',fence:1};});
 const port:ShadowPort={read:async event=>rows.get(event)??null,claim,publish};
 const now=()=> '2026-10-31T03:00:00Z';
 const doc=makeNarrative({cik:'0000050863',accession:'0000050863-26-000100',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/ex99.htm',
 html:'<p>We expect customer demand to continue to increase, and we plan to expand manufacturing capacity to support customer requirements in the coming year.</p>',publishedAt:'2026-10-30T20:00:00Z',retrievedAt:'2026-10-31T02:00:00Z'});
 const generate=vi.fn(async()=>({hypotheses:[]}));
 const deps={enabled:vi.fn(async()=>true),port,model:vi.fn(()=>({generate})),now,
  collectNarratives:vi.fn(async()=>[doc]),collectFacts:vi.fn(async()=>({documents:[],facts:[],failures:[],rejected:0}))};
 return {deps,generate,claim,publish,rows};
}
describe('private scheduled pilot',()=>{
 it('keeps failures retryable instead of permanently finalizing the collection',async()=>{
  const s=setup();s.deps.collectNarratives.mockRejectedValueOnce(new Error('network'));
  await runSecShadowPilot('INTC',s.deps);
  expect(s.publish.mock.calls.at(-1)![0].retryable).toBe(true);
  expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('stored');
  expect(s.deps.collectNarratives).toHaveBeenCalledTimes(2);
  expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('finished');
 });
 it('rejects arbitrary historical retries before any source calls',async()=>{
  const s=setup();expect((await runSecShadowPilot('INTC',s.deps,'2026-10-01')).status).toBe('invalid_retry_day');
  expect((await runSecShadowPilot('INTC',s.deps,'2026-11-01')).status).toBe('invalid_retry_day');expect(s.claim).not.toHaveBeenCalled();
 });
 it('checks symbol, expiry and both controls before collection or model creation',async()=>{
  const s=setup();expect((await runSecShadowPilot('UNKNOWN',s.deps)).status).toBe('invalid_symbol');
  s.deps.enabled.mockResolvedValue(false);expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('disabled');
  expect(s.claim).not.toHaveBeenCalled();expect(s.deps.collectNarratives).not.toHaveBeenCalled();expect(s.deps.model).not.toHaveBeenCalled();
 });
 it('leases before source IO, records private results and skips same-day repeated work',async()=>{
  const s=setup();s.deps.collectNarratives.mockImplementationOnce(async()=>{expect(s.claim).toHaveBeenCalledTimes(2);return [];});
  expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('stored');
  expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('finished');
  expect(s.deps.collectNarratives).toHaveBeenCalledTimes(1);expect(s.generate).not.toHaveBeenCalled();
 });
 it('performs the evidence cycle without exposing model prose or publishing to public storage',async()=>{
  const s=setup();const result=await runSecShadowPilot('INTC',s.deps);expect(result.status).toBe('stored');expect(result.publicEligible).toBe(false);
  expect(s.generate).toHaveBeenCalledTimes(1);expect(s.rows.get('sec:INTC')?.snapshot.narrative?.run.assessment?.status).toBe('facts_only');
  expect(JSON.stringify(result)).not.toContain('hypotheses');expect(s.rows.size).toBe(3);
 });
 it('records a safe failure reason without raw provider text or model spending',async()=>{
  const s=setup();s.deps.collectNarratives.mockRejectedValue(new Error('private transport body'));
  expect(await runSecShadowPilot('INTC',s.deps)).toMatchObject({status:'stored',collection:{status:'source_unavailable',errorCode:'pilot_processing_failed'},publicEligible:false});
  expect(s.publish).toHaveBeenCalledTimes(2);expect(s.generate).not.toHaveBeenCalled();
  expect(s.rows.get('collection:INTC:2026-10-31')?.snapshot.decision.reasonCodes).toContain('pilot_processing_failed');
 });
 it('does not generate on a partial structured source failure or a busy collection lease',async()=>{
  const s=setup();s.claim.mockResolvedValueOnce({status:'busy'});expect((await runSecShadowPilot('INTC',s.deps)).status).toBe('busy');
  expect(s.deps.collectNarratives).not.toHaveBeenCalled();
  s.deps.collectFacts.mockResolvedValueOnce({documents:[],facts:[],failures:['Revenues'] as never[],rejected:0});
  expect(await runSecShadowPilot('INTC',s.deps)).toMatchObject({collection:{status:'source_unavailable'}});expect(s.generate).not.toHaveBeenCalled();expect(s.publish).toHaveBeenCalledTimes(2);
 });
});

it('continues zero-model facts collection after the narrative pilot closes',async()=>{
 const s=setup();const result=await runSecShadowPilot('INTC',{...s.deps,now:()=> '2026-11-14T08:00:00Z'});
 expect(result).toMatchObject({status:'stored',collection:{status:'facts_updated'}});
 expect(s.deps.collectFacts).toHaveBeenCalledOnce();expect(s.deps.collectNarratives).not.toHaveBeenCalled();expect(s.deps.model).not.toHaveBeenCalled();
});
