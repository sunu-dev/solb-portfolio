import { requireServiceClient } from '../supabaseServer';
import type { ShadowPort,ShadowSnapshot } from './shadowCycle';
/** Server/service-role only. Existing public market-watch GET does not import this. */
export function createMarketCauseShadowPort():ShadowPort {
 const db=requireServiceClient();
 return {
  async read(event) {
   const {data,error}=await db.rpc('read_market_cause_shadow',{p_event:event});
   if(error)throw new Error('shadow_read_unavailable');
   if(data===null)return null;
   if(!Number.isSafeInteger(data.revision)||data.revision<1||!data.payload?.snapshot)throw new Error('invalid_shadow_record');
   const snapshot=data.payload.snapshot as ShadowSnapshot;
   if(!snapshot.context||!Array.isArray(snapshot.documents)||!Array.isArray(snapshot.facts)||!Array.isArray(snapshot.decision?.claims))throw new Error('invalid_shadow_snapshot');
   return {revision:data.revision,snapshot};
  },
  async claim(key,event,hash,owner) {
   const {data,error}=await db.rpc('claim_market_cause_job',{p_key:key,p_event:event,p_hash:hash,p_owner:owner});
   if(error||!data)throw new Error('shadow_claim_unavailable');
   if(data.status==='claimed'&&Number.isSafeInteger(data.fence)&&data.fence>0)return {status:'claimed',fence:data.fence};
   if(['disabled','busy','finished','attempts_exhausted','input_mismatch'].includes(data.status))return {status:data.status as 'disabled'|'busy'|'finished'|'attempts_exhausted'|'input_mismatch'};
   throw new Error('invalid_shadow_claim');
  },
  async publish(input) {
   const {data,error}=await db.rpc('publish_market_cause_shadow',{p_key:input.key,p_hash:input.hash,p_owner:input.owner,p_fence:input.fence,
    p_expected_revision:input.expectedRevision,p_payload:{disposition:input.snapshot.decision.disposition,claims:input.snapshot.decision.claims,snapshot:input.snapshot,retryable:input.retryable===true}});
   if(error||!data||!['stored','disabled','stale_worker','revision_conflict'].includes(data.status))throw new Error('shadow_publish_unavailable');
   return data.status as 'stored'|'disabled'|'stale_worker'|'revision_conflict';
  },
 };
}
