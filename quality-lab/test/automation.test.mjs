import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {automationGate,runAutomationCycle,automationReadiness,AUTOMATION_POLICY} from '../src/automation.mjs';
import {buildRun,normalizeReview} from '../src/engine.mjs';
const at=Date.now();
const policy=()=>({version:AUTOMATION_POLICY,enabled:true,incidentHold:false,workerRelease:{root:'/tested-release',sha256:'0'.repeat(64)},maxJobs:2,providerQuotaVerified:true,quotaVerifiedAt:new Date(at).toISOString(),dartConfigured:false,captureAfter:true});
const snapshot=()=>({project:'ytowigkzunbrhyucbsqu',captured_at:new Date(at).toISOString(),health:{status:200,data:['db','auth','rest'].map(name=>({name,healthy:true}))},sql:{status:201},config:{status:200},metrics:{status:200},comparison:{disk_counters_comparable:true,elapsed_hours:5/60,disk_rates:['reads_completed','writes_completed','read_bytes','written_bytes'].map(x=>({counter:`vda/node_disk_${x}_total`,per_second:1,increase:300}))}});
const run=()=>buildRun(['CARG','AA','BETA','017670.KS'].map(symbol=>normalizeReview({symbol,checkedAt:new Date(at).toISOString(),businessLevel:'missing',sections:{'회사 이해':'사업 설명','거래일 브리핑':'기사','배우기':'개념'}})));
async function temp(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-auto-'));try{await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
function ports(){const called=[];return {called,healthy:async()=>true,dispatch:async()=>called.push('dispatch'),progress:async m=>({requestId:m.id,results:m.requests.map(r=>({symbol:r.symbol,state:'queued',next_attempt_at:new Date(at-1000).toISOString()}))}),run:async s=>{called.push(s);return {status:'approval_pending'};},capture:async()=>called.push('capture')};}
test('an active incident blocks all queue/model/capture work even with healthy samples',()=>temp(async root=>{
 const p=ports();const r=await runAutomationCycle({run:run(),snapshot:snapshot(),policy:{...policy(),incidentHold:true},root,ports:p,now:()=>at+10000,execute:true});assert.equal(r.gate.allowed,false);assert.deepEqual(p.called,[]);
}));
test('unavailable, incomplete, stale and high-pressure observations fail closed',()=>{
 for(const change of [s=>s.sql.status=544,s=>s.health.data.pop(),s=>s.metrics.status=500,s=>s.comparison.disk_rates.pop(),s=>s.comparison.elapsed_hours=NaN,s=>s.captured_at=new Date(at-11*60000).toISOString(),s=>s.comparison.disk_rates[0].per_second=251]){const s=snapshot();change(s);assert.equal(automationGate({snapshot:s,policy:policy(),now:at}).allowed,false);}
 assert.equal(automationGate({snapshot:snapshot(),policy:policy(),now:at}).allowed,true);
});
test('dry observation never dispatches; the daily ledger prevents duplicate processing across runs',()=>temp(async root=>{
 const p=ports(),r=run(),base={run:r,snapshot:snapshot(),policy:policy(),root,ports:p,now:()=>at+10000};
 await runAutomationCycle(base);assert.deepEqual(p.called,[]);
 await runAutomationCycle({...base,execute:true});assert.deepEqual(p.called,['dispatch','CARG','AA','capture']);
 p.called.length=0;await runAutomationCycle({...base,execute:true});assert.deepEqual(p.called,[]);
}));
test('uncertain worker failure consumes its local attempt and cannot hot-retry on restart',()=>temp(async root=>{
 const p=ports();p.run=async s=>{p.called.push(s);throw Error('timeout');};const base={run:run(),snapshot:snapshot(),policy:policy(),root,ports:p,now:()=>at+10000,execute:true};
 await assert.rejects(()=>runAutomationCycle(base),/timeout/);p.run=async s=>{p.called.push(s);return {status:'held'};};await runAutomationCycle(base);assert.deepEqual(p.called,['dispatch','CARG','AA','capture']);
}));
test('runtime outage before handoff does not enqueue work',()=>temp(async root=>{
 const p=ports();p.healthy=async()=>false;const r=await runAutomationCycle({run:run(),snapshot:snapshot(),policy:policy(),root,ports:p,now:()=>at+10000,execute:true});assert.equal(r.gate.allowed,false);assert.deepEqual(p.called,[]);
}));
test('source-unconfigured domestic issuers and unrelated progress never trigger model calls',()=>temp(async root=>{
 const p=ports(),base={run:run(),snapshot:snapshot(),policy:{...policy(),maxJobs:3},root,ports:p,now:()=>at+10000,execute:true};
 await runAutomationCycle(base);assert(!p.called.includes('017670.KS'));
 p.progress=async m=>({requestId:m.id,results:[{symbol:'UNREQUESTED',state:'queued'}]});await assert.rejects(()=>runAutomationCycle(base),/progress_mismatch/);
}));
test('readiness reports throughput honestly and never turns unresolved gates into a pass',()=>{
 const r=automationReadiness({inventory:8020,approved:1,gates:{sources:false,health:false,semantics:false}});assert.equal(r.minimumInitialDays,8019);assert.equal(r.ready,false);assert.equal(r.blockers.length,3);
});
test('cached counters and incomplete second-device metrics do not authorize execution',()=>{
 const s=snapshot();s.comparison.disk_rates.forEach(r=>{r.increase=0;r.per_second=0;});
 assert(automationGate({snapshot:s,policy:policy(),now:at}).reasons.includes('io_freshness_unproven'));
 const partial=snapshot();partial.comparison.disk_rates.push({counter:'vdb/node_disk_reads_completed_total',per_second:1,increase:300});
 assert(automationGate({snapshot:partial,policy:policy(),now:at}).reasons.includes('io_metrics_incomplete'));
});
test('concurrent cycles cannot dispatch and lock metadata identifies the active process',()=>temp(async root=>{
 let resume,started;const waiting=new Promise(r=>{started=r;});const p=ports();
 p.run=async symbol=>{started();await new Promise(r=>{resume=r;});return {status:'held',symbol};};
 const base={run:run(),snapshot:snapshot(),policy:policy(),root,ports:p,now:()=>at+10000,execute:true};
 const first=runAutomationCycle(base);await waiting;
 try {
  const meta=JSON.parse(await fs.readFile(path.join(root,'automation.lock'),'utf8'));assert.equal(meta.pid,process.pid);
  await assert.rejects(()=>runAutomationCycle(base),/already_running/);
 }finally{resume();await first;}
 assert.deepEqual(p.called,['dispatch','capture']);
}));
test('duplicate receipt rows and mismatched worker results are recorded without unsafe retry',()=>temp(async root=>{
 const p=ports(),base={run:run(),snapshot:snapshot(),policy:policy(),root,ports:p,now:()=>at+10000,execute:true};
 const normal=p.progress;p.progress=async m=>{const r=await normal(m);r.results.push(r.results[0]);return r;};
 await assert.rejects(()=>runAutomationCycle(base),/progress_mismatch/);assert.deepEqual(p.called,['dispatch']);
 p.progress=normal;p.run=async()=>({status:'approval_pending',symbol:'UNREQUESTED'});
 await assert.rejects(()=>runAutomationCycle(base),/worker_mismatch/);
 const evidence=await Promise.all((await fs.readdir(root)).filter(f=>f.startsWith('cycle-')).map(f=>fs.readFile(path.join(root,f),'utf8').then(JSON.parse)));
 assert.deepEqual(new Set(evidence.map(e=>e.failure)),new Set(['automation_progress_mismatch','automation_worker_mismatch']));
 const ledger=JSON.parse(await fs.readFile(path.join(root,`automation-${new Date(at).toISOString().slice(0,10)}.json`),'utf8'));assert.deepEqual(ledger.attempted,['CARG']);
}));
