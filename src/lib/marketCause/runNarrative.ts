import { canonicalDigest } from './normalizeFacts';
import { makeNarrativePacket,selectValidHypotheses,assessNarratives,hypothesisPrompt,reviewPrompt,type NarrativeAssessment } from './narrativeReview';
import type {NarrativeModel} from './narrativeModel';
import type {NarrativeDocument} from './narrativeEvidence';
import type {Context} from './types';
import { resumeDraft, type NarrativeCheckpoint } from './narrativeCheckpoint';
export interface NarrativeRun {
 status:'reviewed'|'no_evidence'|'failed';assessment:NarrativeAssessment|null;errorCode:string|null;
 /** Raw model output is not a publishable report. */
 publicEligible:false;
}
export async function runNarrative(input:{documents:NarrativeDocument[];context:Context;model:NarrativeModel;attemptKey:string;
 checkpoint?:NarrativeCheckpoint;saveDraft?:(draft:NarrativeCheckpoint)=>Promise<void>;now?:()=>string}):Promise<NarrativeRun>{
 const packet=makeNarrativePacket(input.documents,input.context);
 if(!Object.keys(packet.passages).length)return {status:'no_evidence',assessment:null,errorCode:null,publicEligible:false};
 if(!/^[a-zA-Z0-9:_./-]{1,80}$/.test(input.attemptKey))throw new Error('invalid_narrative_attempt_key');
 try{
  const now=input.now??(()=>new Date().toISOString());
  const resumed=resumeDraft(input.checkpoint,packet,now());
  const {hypotheses,discardedCandidates}=resumed??selectValidHypotheses(await input.model.generate(`${input.attemptKey}:${packet.inputHash}:draft`,hypothesisPrompt(packet)),packet);
  if(!hypotheses.length)return {status:'reviewed',assessment:{status:'facts_only',hypotheses:[],rejected:[],inputHash:packet.inputHash,hypothesesHash:canonicalDigest([]),
   policyVersion:packet.version,reviewedPassages:0,omittedPassages:packet.omitted,publicEligible:false,reviews:[],candidates:[],discardedCandidates},errorCode:null,publicEligible:false};
  if(!resumed&&input.saveDraft)await input.saveDraft({policy:packet.version,inputHash:packet.inputHash,hypothesesHash:canonicalDigest(hypotheses),createdAt:now(),evidenceAsOf:input.context.asOf,hypotheses,discardedCandidates});
  const review=await input.model.generate(`${input.attemptKey}:${packet.inputHash}:review`,reviewPrompt(packet,hypotheses),
   {inputHash:packet.inputHash,hypothesesHash:canonicalDigest(hypotheses),passageIds:Object.keys(packet.passages),hypothesisIds:hypotheses.map(h=>h.id)});
  return {status:'reviewed',assessment:{...assessNarratives(packet,hypotheses,review),discardedCandidates},errorCode:null,publicEligible:false};
 }catch(error){
  // Persist a controlled reason, not provider error bodies that might contain prompts/credentials.
  const message=error instanceof Error?error.message:'';
  const safe=/^(?:invalid|incomplete|unbound|unknown|overlapping|narrative)_[a-z_]+$/.test(message)?message:'narrative_processing_failed';
  return {status:'failed',assessment:null,errorCode:safe,publicEligible:false};
 }
}
