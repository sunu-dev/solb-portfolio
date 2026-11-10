import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, validSymbol } from './engine.mjs';
import { repairManifest } from './improvement.mjs';

export const AUTOMATION_POLICY = 'automation-v1';
const PROJECT = 'ytowigkzunbrhyucbsqu';
const recent = (at, now, max) => Number.isFinite(Date.parse(at)) && Date.parse(at)<=now && now-Date.parse(at)<=max;

/** A low-rate observation is not proof of available burst budget. An active
 * incident remains a hold until explicitly cleared after actual recovery. */
export function automationGate({snapshot,policy,now=Date.now()}) {
  const reasons=[];
  if(policy?.version!==AUTOMATION_POLICY)reasons.push('policy_missing');
  if(policy?.enabled!==true)reasons.push('automation_disabled');
  if(policy?.incidentHold!==false)reasons.push('incident_hold');
  if(!path.isAbsolute(policy?.workerRelease?.root??'')||!/^[a-f0-9]{64}$/.test(policy?.workerRelease?.sha256??''))reasons.push('worker_release_unconfigured');
  if(!Number.isInteger(policy?.maxJobs)||policy.maxJobs<1||policy.maxJobs>3)reasons.push('invalid_job_limit');
  if(snapshot?.project!==PROJECT||!recent(snapshot?.captured_at,now,10*60000))reasons.push('health_observation_stale');
  if(snapshot?.health?.status!==200||!['db','auth','rest'].every(name=>snapshot.health.data?.some(s=>s.name===name&&s.healthy===true)))reasons.push('services_unhealthy');
  if(snapshot?.sql?.status!==201||snapshot?.config?.status!==200)reasons.push('database_path_unavailable');
  const comparison=snapshot?.comparison;
  if(snapshot?.metrics?.status!==200||comparison?.disk_counters_comparable!==true
    ||!Number.isFinite(comparison?.elapsed_hours)||comparison.elapsed_hours<1/60||comparison.elapsed_hours>1/4)reasons.push('io_window_missing');
  const rates=Array.isArray(comparison?.disk_rates)?comparison.disk_rates:[];
  // Require read and write operations AND throughput; incomplete metrics never pass.
  for(const metric of ['reads_completed','writes_completed','read_bytes','written_bytes']) {
    const points=rates.filter(r=>typeof r?.counter==='string'&&r.counter.endsWith(`/node_disk_${metric}_total`));
    if(!points.length||points.some(p=>!Number.isFinite(p.per_second)||p.per_second<0))reasons.push('io_metrics_incomplete');
  }
  // Keep devices separate (parent/partition totals would double-count). Bounds
  // are conservative pilot limits, not a claim to know Supabase credit balance.
  const devices=new Map();
  for(const r of rates){if(typeof r?.counter!=='string')continue;const [device,metric]=r.counter.split('/');const v=devices.get(device)??{ops:0,bytes:0,metrics:new Set()};
    if(/node_disk_(reads|writes)_completed_total/.test(metric))v.ops+=r.per_second;
    if(/node_disk_(read|written)_bytes_total/.test(metric))v.bytes+=r.per_second;
    v.metrics.add(metric);
    devices.set(device,v);
  }
  if([...devices.values()].some(d=>['reads_completed','writes_completed','read_bytes','written_bytes'].some(m=>!d.metrics.has(`node_disk_${m}_total`))))reasons.push('io_metrics_incomplete');
  // The provider refreshes metrics once a minute. Identical counters may be a
  // cached sample; they cannot prove fresh low load, even when SQL is healthy.
  if(!rates.some(r=>Number.isFinite(r?.increase)&&r.increase>0))reasons.push('io_freshness_unproven');
  if([...devices.values()].some(d=>d.ops>50||d.bytes>1024*1024))reasons.push('io_pressure_high');
  if(!recent(policy?.quotaVerifiedAt,now,24*3600000)||policy?.providerQuotaVerified!==true)reasons.push('provider_quota_unverified');
  return {policy:AUTOMATION_POLICY,allowed:reasons.length===0,reasons:[...new Set(reasons)]};
}

/** Ports separate public observation from privileged queue work. There is no
 * approve/publish/code-deploy port; a worker cannot invent editorial approval. */
export async function runAutomationCycle({run,snapshot,policy,root,ports,now=()=>Date.now(),execute=false}) {
  const gate=automationGate({snapshot,policy,now:now()});
  const manifest=repairManifest(run);
  const summary={policy:AUTOMATION_POLICY,requestId:manifest.id,gate,mode:execute?'execute':'observe',steps:[],startedAt:new Date(now()).toISOString()};
  if(!execute||!gate.allowed)return summary;
  if(!recent(run.createdAt,now(),24*3600000))return {...summary,gate:{...gate,allowed:false,reasons:['capture_stale']}};
  if(!await ports.healthy())return {...summary,gate:{...gate,allowed:false,reasons:['database_path_unavailable']}};
  await fs.mkdir(root,{recursive:true});const lockPath=path.join(root,'automation.lock');
  const lock=await fs.open(lockPath,'wx').catch(e=>{if(e.code==='EEXIST')throw Error('automation_already_running');throw e;});
  const day=new Date(now()).toISOString().slice(0,10),ledgerPath=path.join(root,`automation-${day}.json`);
  const cycleFile=path.join(root,`cycle-${digest([summary.requestId,summary.startedAt,randomUUID()]).slice(0,20)}.json`);
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:summary.startedAt,requestId:manifest.id}));
    await lock.sync();
    let ledger={day,attempted:[],receipts:[],captures:[]};
    try{ledger=JSON.parse(await fs.readFile(ledgerPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    if(ledger.day!==day||!Array.isArray(ledger.attempted)||ledger.attempted.some(s=>!validSymbol(s))
      ||!Array.isArray(ledger.receipts)||ledger.receipts.some(id=>!/^[a-f0-9]{64}$/.test(id))
      ||!Array.isArray(ledger.captures))throw Error('automation_ledger_invalid');
    const persist=async()=>{const tmp=ledgerPath+'.tmp';await fs.writeFile(tmp,JSON.stringify(ledger,null,2));await fs.rename(tmp,ledgerPath);};
    if(!ledger.receipts.includes(manifest.id)){
      await ports.dispatch(manifest);ledger.receipts.push(manifest.id);await persist();summary.steps.push('queue_handoff');
    }
    const progress=await ports.progress(manifest);summary.steps.push('progress_read');
    const allowed=new Set(manifest.requests.map(r=>r.symbol));
    if(progress.requestId!==manifest.id||!Array.isArray(progress.results)||progress.results.some(r=>!allowed.has(r.symbol))
      ||new Set(progress.results.map(r=>r.symbol)).size!==progress.results.length)throw Error('automation_progress_mismatch');
    const eligible=progress.results.filter(r=>['queued','blocked','review_pending'].includes(r.state)&&!ledger.attempted.includes(r.symbol)
      && (policy.dartConfigured===true||!/(?:\.KS|\.KQ)$/.test(r.symbol))
      && Number.isFinite(Date.parse(r.next_attempt_at))&&Date.parse(r.next_attempt_at)<=now());
    for(const row of eligible){
      if(ledger.attempted.length>=policy.maxJobs)break;
      // Recheck the actual DB path between jobs. Reserve locally before execution
      // so a crash/timeout never makes an uncertain attempt free to repeat.
      if(!await ports.healthy()){summary.steps.push('stopped_unhealthy');break;}
      ledger.attempted.push(row.symbol);await persist();
      const result=await ports.run(row.symbol);
      if(!['held','stale_worker','idle','approval_pending','unchanged'].includes(result?.status)
        ||(result.symbol!==undefined&&result.symbol!==row.symbol))throw Error('automation_worker_mismatch');
      summary.steps.push({symbol:row.symbol,status:result.status});
      if(result.status==='held'||result.status==='stale_worker'||result.status==='idle')break;
    }
    await ports.progress(manifest);summary.steps.push('progress_recorded');
    // Captures can only mark actual published versions delivered; no self-approval.
    if(policy.captureAfter===true&&ledger.captures.length===0&&await ports.healthy()){
      ledger.captures.push(manifest.id);await persist();await ports.capture(run);summary.steps.push('screen_captured');
    }
    summary.finishedAt=new Date(now()).toISOString();
    await fs.writeFile(cycleFile,JSON.stringify(summary,null,2),{flag:'wx'});return summary;
  } catch(error) {
    // Do not serialize arbitrary provider/child-process errors: they can contain
    // credentials or source payloads. Preserve phase and a fixed failure code.
    const known=['automation_ledger_invalid','automation_progress_mismatch','automation_worker_mismatch'];
    summary.failure=known.includes(error?.message)?error.message:'automation_dependency_failed';
    summary.finishedAt=new Date(now()).toISOString();
    await fs.writeFile(cycleFile,JSON.stringify(summary,null,2),{flag:'wx'}).catch(()=>{});
    throw error;
  } finally {await lock.close();await fs.unlink(lockPath).catch(()=>{});}
}

export function automationReadiness({inventory=0,requestsPerDay=1,jobsPerRequest=1,sourceReady=0,approved=0,gates={}}){
  const throughput=requestsPerDay*jobsPerRequest;
  return {inventory,sourceReady,approved,unexplained:Math.max(0,inventory-approved),
    minimumInitialDays:throughput>0?Math.ceil(Math.max(0,inventory-approved)/throughput):null,
    assumption:'No refresh, failure, retry or editorial delay; this is a lower bound, not a completion forecast.',
    ready:Object.values(gates).length>0&&Object.values(gates).every(x=>x===true),
    blockers:Object.entries(gates).filter(([,value])=>value!==true).map(([key])=>key)};
}
