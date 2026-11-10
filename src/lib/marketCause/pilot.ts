import { randomUUID } from 'node:crypto';
import { digest } from './normalizeFacts';
import { collectSecEvidence } from './sources/collectSec';
import { collectSecNarratives } from './sources/secNarrative';
import { runShadowCycle,type ShadowPort,type ShadowSnapshot } from './shadowCycle';
import { createMarketCauseShadowPort } from './supabaseShadowPort';
import { createMarketCauseBudgetPort } from './supabaseBudgetPort';
import { createNarrativeModel,type NarrativeModel } from './narrativeModel';
import { requireServiceClient } from '../supabaseServer';
import { POLICY_VERSION } from './publicationPolicy';
import { NARRATIVE_POLICY } from './narrativeReview';
import type {ProviderAttempt} from './providerDiagnostics';
import { saveCompanyFacts } from './companyFactsCycle';

export const PILOT_END='2026-11-14T08:00:00Z';
export const PILOT_COMPANIES={INTC:'0000050863',NVDA:'0001045810',AMD:'0000002488',AMZN:'0001018724',
 GOOGL:'0001652044',MSFT:'0000789019',META:'0001326801',AAPL:'0000320193'} as const;
// Public operator contact already shown in the service's terms/privacy pages.
const SEC_AGENT='Joobi/1.0 sunu.develop@gmail.com';
interface PilotDependencies {
 enabled():Promise<boolean>;port:ShadowPort;model():NarrativeModel;
 collectFacts:typeof collectSecEvidence;collectNarratives:typeof collectSecNarratives;now():string;
}
function dependencies():PilotDependencies{
 const db=requireServiceClient();
 return {enabled:async()=>{const {data,error}=await db.rpc('market_cause_worker_enabled');
   if(error||typeof data!=='boolean')throw new Error('pilot_control_unavailable');return data;},
  port:createMarketCauseShadowPort(),model:()=>createNarrativeModel(process.env.GEMINI_API_KEY??'',createMarketCauseBudgetPort()),
  collectFacts:collectSecEvidence,collectNarratives:collectSecNarratives,now:()=>new Date().toISOString()};
}
/** Daily, shared public-evidence pilot. No user identifiers/holdings, public writes,
 * notifications or inferred price causes. Collection is leased before network IO. */
export async function runSecShadowPilot(symbol:string,deps?:PilotDependencies,retryDay?:string){
 if(!Object.hasOwn(PILOT_COMPANIES,symbol))return {status:'invalid_symbol',publicEligible:false};
 // Model calls stop independently of controls/tariff expiry; source-only collection continues.
 const d=deps??dependencies();const started=d.now();
 if(!Number.isFinite(Date.parse(started)))throw new Error('invalid_pilot_clock');
 const narrativeEnabled=Date.parse(started)<Date.parse(PILOT_END);
 if(!await d.enabled())return {status:'disabled',publicEligible:false};
 const cik=PILOT_COMPANIES[symbol as keyof typeof PILOT_COMPANIES];
 const day=retryDay??started.slice(0,10);
 // Recovery may only revisit the preceding 48 hours, never invent a historical cutoff.
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||day>started.slice(0,10)
  ||Date.parse(started)-Date.parse(day+'T00:00:00Z')>48*3600000)return {status:'invalid_retry_day',publicEligible:false};
 const owner=randomUUID(),event=`collection:${symbol}:${day}`;
 const hash=digest(['sec-collection-v2',NARRATIVE_POLICY,symbol,day,narrativeEnabled]);const key=`fetch:${hash}`;
 const previousCollection=await d.port.read(event);
 const claim=await d.port.claim(key,event,hash,owner);
 if(claim.status!=='claimed')return {status:claim.status,publicEligible:false};
 let result:{status:string;[key:string]:unknown};
 let factsUpdated=false;
 try{
  // Serial requests share one bounded SEC identity and avoid bursts.
  const evidence=await d.collectFacts({cik,userAgent:SEC_AGENT,
   concepts:[symbol==='GOOGL'?'Revenues':'RevenueFromContractWithCustomerExcludingAssessedTax','NetCashProvidedByUsedInOperatingActivities','NetIncomeLoss','PaymentsToAcquirePropertyPlantAndEquipment'],now:d.now});
  if(evidence.failures.length)throw new Error('structured_source_unavailable');
  const windowStart=new Date(Math.floor(Date.parse(started)/(7*86400000))*7*86400000-7*86400000).toISOString();
  const factsStatus=await saveCompanyFacts({symbol,owner,context:{asOf:d.now(),windowStart,entityIds:[`CIK${cik}`]},
   documents:evidence.documents,facts:evidence.facts,port:d.port});
  if(!['stored','finished'].includes(factsStatus))throw new Error('structured_source_unavailable');
  factsUpdated=true;
  const narratives=narrativeEnabled?await d.collectNarratives({cik,symbol,userAgent:SEC_AGENT,now:d.now}):[];
  const all=[...evidence.documents,...narratives];
  if(!narrativeEnabled)result={status:'facts_updated',documents:evidence.documents.length,facts:evidence.facts.length};
  else if(!all.length)result={status:'no_recent_evidence',documents:0};
  else{
   // Fixed company event keeps prior source versions available for invalidation.
   // Stable window prevents a polling clock change from triggering a new LLM call.
   const context={asOf:d.now(),windowStart,entityIds:[`CIK${cik}`]};
   const cycle=await runShadowCycle({event:`sec:${symbol}`,owner,context,documents:evidence.documents,facts:evidence.facts,
    port:d.port,narrative:{documents:narratives,model:d.model()}});
   result={...cycle,documents:all.length,facts:evidence.facts.length,narratives:narratives.length};
  }
 }catch(error){
  // Stop exposing a prior fact set after a failed source check. Immutable older
  // versions remain private, and a successful retry can restore the same values.
  if(!factsUpdated)await saveCompanyFacts({symbol,owner,context:{asOf:d.now(),windowStart:started,entityIds:[`CIK${cik}`]},documents:[],facts:[],port:d.port});
  const message=error instanceof Error?error.message:'';
  const errorCode=/^(?:sec_[a-z_]+(?:_\d{3})?|structured_source_unavailable|no_visible_narrative)$/.test(message)?message:'pilot_processing_failed';
  result={status:'source_unavailable',errorCode};
 }
 const context={asOf:d.now(),windowStart:started,entityIds:[`CIK${cik}`]};
 const snapshot:ShadowSnapshot={context,documents:[],facts:[],attempts:Array.isArray(result.attempts)?result.attempts as ProviderAttempt[]:[],decision:{disposition:'facts_only',claims:[],rejected:[],
  reasonCodes:[`collection_${result.status}`,...(typeof result.errorCode==='string'?[result.errorCode]:[])],inputHash:hash,policyVersion:POLICY_VERSION}};
 const retryable=['source_unavailable','analysis_failed','revision_conflict','stale_worker','busy'].includes(result.status);
 const stored=await d.port.publish({key,hash,owner,fence:claim.fence,expectedRevision:previousCollection?.revision??0,snapshot,retryable});
 return {status:stored,collection:result,publicEligible:false};
}
