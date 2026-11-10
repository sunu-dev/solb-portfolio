import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-lab-test-'));
process.env.JOOBI_LAB_DATA=tmp;
const {startServer}=await import('../src/server.mjs');
const {buildRun,normalizeReview}=await import('../src/engine.mjs');
const {saveRun,attachAssessments,readRun}=await import('../src/store.mjs');

test('로컬 서버: 호스트·CSRF·경로 격리, 실행 중복 방지',async()=>{
  let calls=0,release;
  const run=await saveRun(buildRun([normalizeReview({symbol:'ABC',sections:{'회사 이해':'설명','거래일 브리핑':'뉴스','배우기':'질문'}})],{target:'https://joobi.kr'}));
  const server=await startServer({port:0,captureFn:({signal})=>{calls++;return new Promise((r,reject)=>{release=()=>r(run);signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});}});
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const state=await (await fetch(base+'/api/state')).json();
    const rejectedHost=await new Promise((resolve,reject)=>{http.get(base+'/api/state',{headers:{Host:'evil.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
    assert.equal(rejectedHost,403);
    const body=JSON.stringify({runId:run.id});
    assert.equal((await fetch(base+'/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,403);
    const headers={'Content-Type':'application/json','x-lab-session':state.token,Origin:base};
    assert.equal((await fetch(base+'/api/scan',{method:'POST',headers,body})).status,202);
    assert.equal((await fetch(base+'/api/scan',{method:'POST',headers,body})).status,400);
    assert.equal(calls,1);
    assert.equal((await fetch(base+'/api/cancel',{method:'POST',headers,body:'{}'})).status,202);
    assert.equal((await (await fetch(base+'/api/state')).json()).job.status,'cancelled');
    assert.equal((await fetch(base+'/api/run?id=../../package')).status,400);
    assert.equal((await fetch(base+'/images/not-an-image')).status,404);
    const page=await fetch(base+'/');assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    assert.match(await page.text(),/주비改善|주비 개선/);
  } finally {release?.();await new Promise(r=>server.close(r));}
});
test('평가 추가는 이전 검사 결과를 덮어쓰지 않음',async()=>{
  const original=await saveRun(buildRun([normalizeReview({symbol:'XYZ',sections:{'회사 이해':'회사 소개 본문','거래일 브리핑':'거래일 뉴스 본문','배우기':'회사 다음 질문'}})]));
  const next=await attachAssessments(original.id,[]);
  assert.notEqual(next.id,original.id);assert.equal((await readRun(original.id)).parentId,undefined);assert.equal(next.parentId,original.id);
});
test.after(async()=>{await fs.rm(tmp,{recursive:true,force:true});});
