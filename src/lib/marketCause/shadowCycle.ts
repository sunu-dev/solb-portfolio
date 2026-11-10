import { digest } from './normalizeFacts';
import { evaluatePublication, POLICY_VERSION } from './publicationPolicy';
import { reconcileDocuments } from './documentStore';
import { documentReasons } from './validateClaims';
import { NARRATIVE_POLICY,makeNarrativePacket } from './narrativeReview';
import { runNarrative,type NarrativeRun } from './runNarrative';
import { NARRATIVE_MODEL,NARRATIVE_REVIEW_MODEL,type NarrativeModel } from './narrativeModel';
import { reconcileNarratives,type NarrativeDocument } from './narrativeEvidence';
import type {Context,NormalizedFact,PublicationDecision,SourceDocument} from './types';
import type {OfficialSnapshot} from './officialTypes';
import type {ProviderAttempt} from './providerDiagnostics';
import { persistDraft, type NarrativeCheckpoint } from './narrativeCheckpoint';
export interface ShadowSnapshot {
 context:Context;documents:SourceDocument[];facts:NormalizedFact[];decision:PublicationDecision;
 narrative?:{documents:NarrativeDocument[];run:NarrativeRun};
 official?:OfficialSnapshot;
 attempts?:ProviderAttempt[];
 company?:{symbol:string;policy:string;corrected:boolean;fingerprint?:string};
 draft?:NarrativeCheckpoint;
}
export interface ShadowPort {
 read(event:string):Promise<{revision:number;snapshot:ShadowSnapshot}|null>;
 claim(key:string,event:string,hash:string,owner:string):Promise<{status:'claimed';fence:number}|{status:'disabled'|'busy'|'finished'|'attempts_exhausted'|'input_mismatch'}>;
 publish(input:{key:string;hash:string;owner:string;fence:number;expectedRevision:number;snapshot:ShadowSnapshot;retryable?:boolean}):Promise<'stored'|'disabled'|'stale_worker'|'revision_conflict'>;
}
/** No public publication. Optional narrative review uses a separately budgeted model. The caller supplies only source-adapter facts.
 * The first integration exercises durable evidence gathering without promoting templates
 * or model-selected references to a verified explanation of stock prices.
 */
export async function runShadowCycle(input:{event:string;owner:string;context:Context;documents:SourceDocument[];facts:NormalizedFact[];port:ShadowPort;
 narrative?:{documents:NarrativeDocument[];model:NarrativeModel}}) {
 if(!/^[a-zA-Z0-9:_./-]{1,160}$/.test(input.event))throw new Error('invalid_event');
 const prior=await input.port.read(input.event);
 const documents=reconcileDocuments(prior?.snapshot.documents??[],input.documents);
 for(const next of input.facts) {
  const old=prior?.snapshot.facts.find(f=>f.id===next.id);
  if(old&&old.provenanceHash!==next.provenanceHash)throw new Error('immutable_fact_changed');
 }
 const narrativeDocuments=input.narrative?reconcileNarratives(prior?.snapshot.narrative?.documents??[],input.narrative.documents):undefined;
 const facts=[...new Map([...(prior?.snapshot.facts??[]),...input.facts].map(f=>[f.id,f])).values()];
 const candidates=facts.slice(0,100).map((f,i)=>({id:`fact:${i}`,kind:'fact',factId:f.id}));
 const decision=evaluatePublication({context:input.context,documents,facts,candidates,
   previousDocumentIds:prior?.snapshot.decision.disposition==='withdrawn'?[]:prior?.snapshot.decision.claims.flatMap(c=>c.documentIds)});
 let narrative:ShadowSnapshot['narrative'];
 const previousNarrative=prior?.snapshot.narrative;
 // Revoke before trying a model. A provider outage must not retain an invalid
 // explanation. Reconstruct the original reference map, not this run's ranking.
 const previousPacket=previousNarrative?.run.assessment?.hypotheses.length
   ?makeNarrativePacket(previousNarrative.documents,prior!.snapshot.context):undefined;
 const previousNarrativeIds=previousPacket?new Set(previousNarrative!.run.assessment!.hypotheses.flatMap(h=>
   [...h.support,...h.counterEvidence].map(key=>previousPacket.passages[key]?.documentId))):new Set<string>();
 const invalidatedNarrative=[...previousNarrativeIds].some(id=>{
  const next=narrativeDocuments?.find(d=>d.id===id);
  return !next||documentReasons(next,input.context).length>0||Date.parse(next.publishedAt!)<Date.parse(input.context.windowStart);
 });
 const noNarrativeEvidence=!narrativeDocuments?.length||!Object.keys(makeNarrativePacket(narrativeDocuments,input.context).passages).length;
 if(prior?.snapshot.decision.disposition==='withdrawn'&&!decision.claims.length&&noNarrativeEvidence)decision.disposition='withdrawn';
 const mustWithdraw=decision.disposition==='withdrawn'||invalidatedNarrative;
 if(invalidatedNarrative){decision.disposition='withdrawn';decision.claims=[];decision.reasonCodes.push('previous_narrative_unavailable');}
 // Stable semantic evidence fingerprint: poll/retrieval time changes alone don't schedule work.
 const fingerprint=digest([POLICY_VERSION,mustWithdraw?'invalidate':'analyze',input.event,input.context.windowStart,input.context.entityIds,
   documents.map(d=>[d.id,d.hash,d.status,d.publishedAt,documentReasons(d,input.context)]),
   facts.map(f=>[f.id,f.provenanceHash,f.periodEnd<=input.context.asOf.slice(0,10)]).sort(),
   narrativeDocuments?[NARRATIVE_POLICY,NARRATIVE_MODEL,NARRATIVE_REVIEW_MODEL,narrativeDocuments.map(d=>[d.id,d.hash,d.status,documentReasons(d,input.context)])]:null]);
 const key=`cause:${fingerprint}`;
 const claimed=await input.port.claim(key,input.event,fingerprint,input.owner);
 if(claimed.status!=='claimed')return {status:claimed.status};
 if(input.narrative&&narrativeDocuments){
  const checkpoint=mustWithdraw?undefined:(await input.port.read(`draft:${input.event}`))?.snapshot.draft;
  const run:NarrativeRun=mustWithdraw?{status:'no_evidence',assessment:null,errorCode:'source_invalidated',publicEligible:false}
   :await runNarrative({documents:narrativeDocuments,context:input.context,model:input.narrative.model,attemptKey:`shadow:${fingerprint.slice(0,40)}:${claimed.fence}`,
    checkpoint,saveDraft:draft=>persistDraft(input.port,input.event,input.owner,draft)});
  // Leave an unsuccessful attempt leased, then allow the repository's bounded retry.
  // Never replace a verified snapshot with a failed model response.
  if(run.status==='failed')return {status:'analysis_failed',errorCode:run.errorCode,attempts:input.narrative.model.diagnostics?.()??[]};
  narrative={documents:narrativeDocuments,run};
 }
 const status=await input.port.publish({key,hash:fingerprint,owner:input.owner,fence:claimed.fence,expectedRevision:prior?.revision??0,
   snapshot:{context:input.context,documents,facts,decision,...(narrative?{narrative,attempts:input.narrative?.model.diagnostics?.()??[]}:{})}});
 return {status,disposition:decision.disposition,claims:decision.claims.length};
}
