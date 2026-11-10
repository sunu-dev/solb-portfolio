import { digest, instant } from './normalizeFacts';
export interface JobState {
 key:string;inputHash:string;fence:number;leaseOwner:string|null;leaseUntil:string|null;
 attempts:number;status:'queued'|'running'|'finished'|'failed';resultHash:string|null;
}
/** Pure transition specification. A DB adapter must lock/CAS this state atomically.
 * This function alone is not a distributed lock and is not connected to a worker yet.
 */
export function claimJob(job:JobState,owner:string,now:string,leaseMs=60000):JobState|null {
 const time=instant(now);
 if(!Number.isFinite(time)||!owner||!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>120000)throw new Error('invalid_claim');
 if(job.status==='finished'||job.attempts>=2||job.status==='running'&&job.leaseUntil&&instant(job.leaseUntil)>time)return null;
 return {...job,fence:job.fence+1,leaseOwner:owner,leaseUntil:new Date(time+leaseMs).toISOString(),attempts:job.attempts+1,status:'running'};
}
export function finishJob(job:JobState,owner:string,fence:number,inputHash:string,result:unknown,now:string):JobState|null {
 const time=instant(now);
 if(!Number.isFinite(time)||job.status!=='running'||job.leaseOwner!==owner||job.fence!==fence
   ||job.inputHash!==inputHash||!job.leaseUntil||instant(job.leaseUntil)<=time)return null;
 return {...job,status:'finished',resultHash:digest(result),leaseOwner:null,leaseUntil:null};
}
