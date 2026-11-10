import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeReview, buildRun, compareRuns } from '../src/engine.mjs';
import { reconcileImprovements, listImprovements, repairManifest } from '../src/improvement.mjs';

const review=(explanation)=>normalizeReview({symbol:'SOXL',businessLevel:'missing',sections:{'회사 이해':'하루 3배 목표와 투자 대상 설명','거래일 브리핑':'최근 소식','배우기':'상품 구조'},explanation});
const observed={captured:true,kind:'fund',summary:'미국 반도체 기업 지수의 하루 수익률 3배를 목표로 해요.',multiple:3,daily:'비용 차감 전 하루 목표로 여러 날 결과는 달라요.',entryLabel:'NYSE 반도체지수',scope:'산업 기업 예시이며 실제 구성 목록은 아니에요.',navigation:'passed'};
test('legacy captures remain unassessed, never silently pass the new criterion',()=>{
  const run=buildRun([review(undefined)]);
  assert.deepEqual(run.explanationCoverage.unassessed,['SOXL']);
  assert.equal(run.explanationCoverage.captured,0);
});
test('daily leveraged products must show the daily basis beside the first description',()=>{
  const run=buildRun([review({...observed,daily:''})]);
  assert.equal(run.cases[0].findings.find(f=>f.rule==='explanation-daily-missing').severity,'critical');
  assert.equal(compareRuns(run,run).deploymentApproved,false);
  assert(!run.cases[0].findings.some(f=>f.rule==='business-missing'));
});
test('a disclosure label alone does not prove navigation or explain the holdings scope',()=>{
  const run=buildRun([review({...observed,scope:'',navigation:'inconclusive'})]);
  assert(run.backlog.some(f=>f.rule==='explanation-scope-missing'));
  assert(run.backlog.some(f=>f.rule==='explanation-navigation-unverified'));
  const changed=buildRun([review(observed)]);
  assert.notEqual(run.cases[0].contentHash,changed.cases[0].contentHash);
});
test('does not retain extra credentials or accept self-awarded truth claims',()=>{
  const run=buildRun([review({...observed,secret:'private-token',truthVerified:true})]);
  assert(!JSON.stringify(run).includes('private-token'));
  assert(!JSON.stringify(run).includes('truthVerified'));
  assert.equal(compareRuns(run,run).decision,'평가 미완료');
});
test('new gaps create durable exploration work without company generation requests',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-explanation-'));
  try {
    const run=buildRun([review({...observed,entryLabel:'',scope:''})]);
    await reconcileImprovements(run,{root});await reconcileImprovements(run,{root});
    const tasks=await listImprovements(root);
    assert.equal(tasks.length,1);assert.equal(tasks[0].kind,'explanation-exploration');
    assert.equal(tasks[0].observations.length,1);
    assert.equal(repairManifest(run).requests.length,0);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('only a later production capture can close exploration delivery; new failures reopen it',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-exploration-lifecycle-'));
  try {
    const before=buildRun([review({...observed,scope:''})]);
    before.cases[0].checkedAt='2026-11-02T01:00:00Z';
    await reconcileImprovements(before,{root});
    const after=buildRun([review(observed)],{source:'static-render'});
    after.cases[0].checkedAt='2026-11-02T01:01:00Z';
    await reconcileImprovements(after,{root});
    assert.equal((await listImprovements(root))[0].state,'engineering-review');
    Object.assign(after,{source:'capture',target:'https://joobi.kr'});
    await reconcileImprovements(after,{root});
    assert.equal((await listImprovements(root))[0].state,'verified-delivery');
    before.cases[0].contentHash='d'.repeat(64);
    await reconcileImprovements(before,{root});
    assert.equal((await listImprovements(root))[0].state,'regression');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
