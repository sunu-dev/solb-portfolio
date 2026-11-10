import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA, writeJson } from './store.mjs';
import { digest, validSymbol } from './engine.mjs';

export const IMPROVEMENT_POLICY = 'improvement-v1';
const repairKind = rule => ['business-missing','business-thin'].includes(rule) ? 'company-business'
  : rule.startsWith('business-content-') ? 'company-content-review'
  : rule.startsWith('explanation-') ? 'explanation-exploration'
  : rule.startsWith('question-path-') || rule.startsWith('question-answer-') || rule.startsWith('question-term-') || rule==='question-language-review' ? 'question-reading-review'
  : rule.startsWith('news-') ? 'news-diagnosis' : 'engineering-review';
const taskId = (symbol,kind) => digest([IMPROVEMENT_POLICY,symbol,kind]).slice(0,20);
const rootAt = root => path.join(root,'improvements');
async function withImprovementLock(root, action) {
  const dir=rootAt(root);await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'reconcile.lock');
  const lock=await fs.open(file,'wx').catch(e=>{if(e.code==='EEXIST')throw Error('improvement_reconcile_running');throw e;});
  try {return await action();} finally {await lock.close();await fs.unlink(file).catch(()=>{});}
}
export async function listImprovements(root=DATA) {
  const dir=rootAt(root);await fs.mkdir(dir,{recursive:true});
  const names=(await fs.readdir(dir)).filter(x=>/^[a-f0-9]{20}\.json$/.test(x));
  return Promise.all(names.map(name=>fs.readFile(path.join(dir,name),'utf8').then(JSON.parse)));
}
/** Immutable observations feed durable work; repeated scans do not reset work or retry limits. */
export async function reconcileImprovements(run,{root=DATA}={}) {
  if(run.annotation?.invalidated)throw Error('invalidated_capture_cannot_create_work');
  if(!/^[a-f0-9]{20}$/.test(run.id)||!Array.isArray(run.cases)||run.cases.some(c=>!validSymbol(c.symbol)))throw Error('invalid_improvement_run');
  const dir=rootAt(root);await fs.mkdir(dir,{recursive:true});
  const lock=await fs.open(path.join(dir,'reconcile.lock'),'wx').catch(e=>{if(e.code==='EEXIST')throw Error('improvement_reconcile_running');throw e;});
  try {
    const tasks=await listImprovements(root),byId=new Map(tasks.map(t=>[t.id,t]));let created=0,changed=0;
    for(const row of run.cases) {
      // A broken capture is evidence for collector work, not a content-generation request.
      const grouped=new Map();
      for(const finding of row.findings??[]) {
        const kind=row.failure?'engineering-review':repairKind(finding.rule);
        const list=grouped.get(kind)??[];list.push(finding.rule);grouped.set(kind,list);
      }
      for(const [kind,rules] of grouped) {
        const id=taskId(row.symbol,kind),previous=byId.get(id);
        const fingerprint=digest([row.contentHash,row.evidenceHash,[...rules].sort()]);
        if(previous?.observations.at(-1)?.fingerprint===fingerprint)continue;
        const observedAt=row.checkedAt||run.createdAt;
        const observation={runId:run.id,engineVersion:run.engineVersion,contentHash:row.contentHash,evidenceHash:row.evidenceHash,fingerprint,rules:[...new Set(rules)],observedAt};
        const task=previous?{...previous}:{id,policy:IMPROVEMENT_POLICY,symbol:row.symbol,kind,state:kind==='company-business'?'queued':'engineering-review',createdAt:observedAt,observations:[]};
        task.observations=[...task.observations,observation].slice(-20);
        // Previously verified delivery can regress; queue a new investigation.
        if(task.state==='verified-delivery')task.state='regression';
        await writeJson(path.join(dir,id+'.json'),task);byId.set(id,task);previous?changed++:created++;
      }
      const business=byId.get(taskId(row.symbol,'company-business'));
      const explanation=byId.get(taskId(row.symbol,'explanation-exploration'));
      if(explanation && explanation.state!=='verified-delivery' && run.source==='capture' && run.target==='https://joobi.kr'
        && !row.failure && row.explanation?.navigation==='passed'
        && Date.parse(row.checkedAt)>Date.parse(explanation.observations.at(-1).observedAt)
        && !(row.findings??[]).some(f=>f.rule.startsWith('explanation-'))) {
        explanation.state='verified-delivery';explanation.delivery={runId:run.id,at:row.checkedAt,kind:'explanation-navigation-only',
          note:'첫 설명·탐색 전달 확인. 금융 사실의 의미 검수나 사용자 이해도 입증은 아님.'};
        await writeJson(path.join(dir,explanation.id+'.json'),explanation);changed++;
      }
      if(business?.publication?.version && business.state!=='verified-delivery' && run.source==='capture' && run.target==='https://joobi.kr'
        && !row.failure && row.navigation?.status==='passed'
        && row.companyExplanation?.status==='passed' && row.companyExplanation.coverage==='detailed'
        && row.businessLevel==='detailed' && row.sourceCount>0 && row.businessVersion===business.publication.version
        && Date.parse(row.checkedAt)>Date.parse(business.publication.at)
        && !(row.findings??[]).some(f=>f.rule.startsWith('business-'))) {
        business.state='verified-delivery';business.delivery={runId:run.id,at:row.checkedAt,version:row.businessVersion,
          note:'공개 버전의 본문 전달 확인. 전체 내용·화면 검수 완료나 사용자 이해도 입증은 아님.'};
        await writeJson(path.join(dir,business.id+'.json'),business);changed++;
      }
    }
    return {policy:IMPROVEMENT_POLICY,created,changed,total:byId.size};
  } finally {await lock.close();await fs.unlink(path.join(dir,'reconcile.lock')).catch(()=>{});}
}
/** No credentials, claims, generated prose or arbitrary URLs cross the release boundary. */
export function repairManifest(run) {
  if(run.annotation?.invalidated)throw Error('invalidated_capture_cannot_create_work');
  const requests=run.cases.filter(row=>!row.failure&&(row.findings??[]).some(f=>['business-missing','business-thin'].includes(f.rule)))
    .map(row=>({symbol:row.symbol,contentHash:row.contentHash,evidenceHash:row.evidenceHash}));
  if(requests.length>30||requests.some(r=>!validSymbol(r.symbol)||!r.contentHash||!r.evidenceHash))throw Error('invalid_repair_manifest');
  const payload={policy:IMPROVEMENT_POLICY,runId:run.id,engineVersion:run.engineVersion,observedAt:run.createdAt,requests};
  return {...payload,id:digest(payload)};
}

export async function recordRepairReceipt(manifest,receipt,{root=DATA}={}) {
  return withImprovementLock(root,()=>recordReceiptUnlocked(manifest,receipt,root));
}
async function recordReceiptUnlocked(manifest,receipt,root) {
  if(receipt.requestId!==manifest.id||!Array.isArray(receipt.results))throw Error('repair_receipt_mismatch');
  const tasks=await listImprovements(root),allowed=new Set(manifest.requests.map(r=>r.symbol));
  const accepted=new Set(['queued','already-requested','not-covered','source-unconfigured','already-published']);
  for(const row of receipt.results) {
    if(!allowed.has(row.symbol)||!accepted.has(row.status))throw Error('invalid_repair_receipt');
  }
  // A queue receipt records handoff only. It does not grant source/model/editorial approval.
  for(const row of receipt.results) {
    const task=tasks.find(t=>t.id===taskId(row.symbol,'company-business'));if(!task)continue;
    if(task.handoff?.requestId===manifest.id)continue;
    task.state=['queued','already-requested'].includes(row.status)?'source-queued':row.status;
    task.handoff={requestId:manifest.id,status:row.status,at:receipt.at};
    await writeJson(path.join(rootAt(root),task.id+'.json'),task);
  }
}

/** Operational readback, not a new approval. Actual delivery still needs a later browser capture. */
export async function recordBusinessProgress(manifest,receipt,{root=DATA}={}) {
  return withImprovementLock(root,()=>recordProgressUnlocked(manifest,receipt,root));
}
async function recordProgressUnlocked(manifest,receipt,root) {
  if(receipt.requestId!==manifest.id||!Array.isArray(receipt.results))throw Error('repair_receipt_mismatch');
  const tasks=await listImprovements(root),allowed=new Set(manifest.requests.map(r=>r.symbol));
  for(const row of receipt.results) {
    if(!allowed.has(row.symbol)||!['queued','collecting','review_pending','approval_pending','published','blocked'].includes(row.state))throw Error('invalid_business_progress');
    if(row.published_version&&(!/^[a-f0-9]{64}$/.test(row.published_version)||!row.editorially_approved||!Number.isFinite(Date.parse(row.approved_at))))throw Error('invalid_publication_receipt');
  }
  for(const row of receipt.results) {
    const task=tasks.find(t=>t.id===taskId(row.symbol,'company-business'));if(!task)continue;
    if(task.state==='source-unconfigured'&&row.state==='queued')continue;
    if(task.progress?.at && Date.parse(receipt.at)<Date.parse(task.progress.at))continue;
    task.state=row.published_version
      ? task.state==='verified-delivery'&&task.publication?.version===row.published_version?'verified-delivery':'published-awaiting-capture'
      : row.state==='published'?'publication-withheld':row.state;
    task.progress={at:receipt.at,sourceCollected:row.source_collected===true,drafted:row.drafted===true,modelReviewed:row.model_reviewed===true,editoriallyApproved:row.editorially_approved===true,
      reason:String(row.reason??'').replace(/[^a-zA-Z0-9_:,.-]/g,'').slice(0,240),nextAttemptAt:row.next_attempt_at};
    task.publication=row.published_version?{version:row.published_version,at:row.approved_at}:null;
    await writeJson(path.join(rootAt(root),task.id+'.json'),task);
  }
}
