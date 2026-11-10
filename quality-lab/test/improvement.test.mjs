import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeReview,buildRun } from '../src/engine.mjs';
import { reconcileImprovements,listImprovements,repairManifest,recordRepairReceipt,recordBusinessProgress } from '../src/improvement.mjs';
const run=()=>buildRun([normalizeReview({symbol:'CARG',checkedAt:new Date().toISOString(),businessLevel:'missing',sections:{'회사 이해':'사업 소개는 준비되지 않았어요','거래일 브리핑':'최근 기사','배우기':'개념 목록'}})],{source:'capture',target:'https://joobi.kr'});
async function temporary(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-improvement-'));try{await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('receipts and progress cannot overwrite a concurrent capture reconciliation',()=>temporary(async root=>{
 const r=run();await reconcileImprovements(r,{root});const m=repairManifest(r);
 const lock=path.join(root,'improvements','reconcile.lock');await fs.writeFile(lock,'busy');
 await assert.rejects(()=>recordRepairReceipt(m,{requestId:m.id,results:[]},{root}),/improvement_reconcile_running/);
 await assert.rejects(()=>recordBusinessProgress(m,{requestId:m.id,results:[]},{root}),/improvement_reconcile_running/);
 assert.equal((await listImprovements(root))[0].state,'queued');await fs.unlink(lock);
 await recordRepairReceipt(m,{requestId:m.id,at:new Date().toISOString(),results:[{symbol:'CARG',status:'queued'}]},{root});
 assert.equal((await listImprovements(root))[0].state,'source-queued');
}));
test('findings create durable company work once, independent of repeated captures',()=>temporary(async root=>{
 const r=run();assert.equal((await reconcileImprovements(r,{root})).created,1);
 assert.equal((await reconcileImprovements(r,{root})).changed,0);
 const tasks=await listImprovements(root);assert.equal(tasks.length,1);assert.equal(tasks[0].state,'queued');
 const manifest=repairManifest(r);assert.equal(manifest.requests.length,1);assert(!JSON.stringify(manifest).includes('사업 소개'));
 await recordRepairReceipt(manifest,{requestId:manifest.id,at:new Date().toISOString(),results:[{symbol:'CARG',status:'queued'}]},{root});
 await reconcileImprovements(r,{root});assert.equal((await listImprovements(root))[0].state,'source-queued');
}));
test('invalid capture never creates generation work and invalidated runs are refused',()=>temporary(async root=>{
 const r=run();r.cases[0].failure='capture timeout';assert.equal(repairManifest(r).requests.length,0);
 await reconcileImprovements(r,{root});assert((await listImprovements(root)).every(t=>t.kind==='engineering-review'));
 r.annotation={invalidated:true};await assert.rejects(()=>reconcileImprovements(r,{root}),/invalidated/);
}));
test('a queue receipt cannot claim approval or inject another company',()=>temporary(async root=>{
 const r=run();await reconcileImprovements(r,{root});const manifest=repairManifest(r);
 for(const result of [{symbol:'OTHER',status:'queued'},{symbol:'CARG',status:'published'}])
  await assert.rejects(()=>recordRepairReceipt(manifest,{requestId:manifest.id,results:[result]},{root}),/invalid_repair_receipt/);
 assert.equal((await listImprovements(root))[0].state,'queued');
}));
test('a detailed screen alone cannot close a repair without a matching publication receipt',()=>temporary(async root=>{
 const r=run();await reconcileImprovements(r,{root});const changed=structuredClone(r);changed.id='b'.repeat(20);changed.cases[0].businessLevel='detailed';changed.cases[0].sourceCount=1;changed.cases[0].findings=[];changed.cases[0].navigation={status:'passed'};
 await reconcileImprovements(changed,{root});assert.equal((await listImprovements(root))[0].state,'queued');
}));
test('only the published version observed later in a working screen closes delivery, and a later gap reopens it',()=>temporary(async root=>{
 const r=run();await reconcileImprovements(r,{root});const m=repairManifest(r),at=r.createdAt;
 const receipt={requestId:m.id,at,results:[{symbol:'CARG',state:'published',published_version:'d'.repeat(64),approved_at:at,editorially_approved:true,source_collected:true,drafted:true,model_reviewed:true}]};
 await recordBusinessProgress(m,receipt,{root});
 const after=structuredClone(r);after.id='e'.repeat(20);Object.assign(after.cases[0],{findings:[],businessLevel:'detailed',sourceCount:1,businessVersion:'f'.repeat(64),checkedAt:new Date(Date.parse(at)+1000).toISOString(),navigation:{status:'passed'}});
 await reconcileImprovements(after,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'published-awaiting-capture');
 after.cases[0].businessVersion='d'.repeat(64);
 // A version in an API response still does not prove that its prose was read.
 await reconcileImprovements(after,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'published-awaiting-capture');
 after.cases[0].companyExplanation={captured:true,status:'passed',coverage:'detailed'};
 after.cases[0].findings=[{rule:'business-content-incomplete'}];
 await reconcileImprovements(after,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'published-awaiting-capture');
 after.cases[0].findings=[];
 for(const meta of [{source:'import',target:'https://joobi.kr'},{source:'capture',target:'http://localhost:3000'}]) {
  Object.assign(after,meta);await reconcileImprovements(after,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'published-awaiting-capture');
 }
 Object.assign(after,{source:'capture',target:'https://joobi.kr'});await reconcileImprovements(after,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'verified-delivery');
 await recordBusinessProgress(m,receipt,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'verified-delivery');
 const regression=run();regression.cases[0].contentHash='f'.repeat(64);await reconcileImprovements(regression,{root});assert.equal((await listImprovements(root)).find(t=>t.kind==='company-business').state,'regression');
}));
