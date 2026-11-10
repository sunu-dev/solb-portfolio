import {it,expect} from 'vitest';
import {parseRepairManifest} from '@/lib/companyBusiness/repairRequest';
import {createHash} from 'node:crypto';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const now=Date.parse('2026-11-01T00:00:00Z');
const base=()=>({policy:'improvement-v1',runId:'a'.repeat(20),engineVersion:'0.2.0',observedAt:new Date(now).toISOString(),requests:[{symbol:'CARG',contentHash:'b'.repeat(64),evidenceHash:'c'.repeat(64)}]});
it('accepts only a recent bound public-quality manifest',()=>{const p=base();expect(parseRepairManifest({...p,id:hash(p)},now).requests[0].symbol).toBe('CARG');});
it('rejects modified symbols, approvals, oversized batches and stale observations',()=>{
 const p=base(),m={...p,id:hash(p)};
 expect(()=>parseRepairManifest({...m,requests:[{...p.requests[0],symbol:'OTHER'}]},now)).toThrow('tampered');
 expect(()=>parseRepairManifest({...m,approval:true},now)).toThrow('invalid');
 expect(()=>parseRepairManifest(m,now+8*86400000)).toThrow('invalid');
 expect(()=>parseRepairManifest({...m,requests:Array(31).fill(p.requests[0])},now)).toThrow('invalid');
});
