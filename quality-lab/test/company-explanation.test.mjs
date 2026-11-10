import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildRun,normalizeReview} from '../src/engine.mjs';
import {normalizeCompanyExplanation} from '../src/company-explanation.mjs';
import {listImprovements,reconcileImprovements,repairManifest} from '../src/improvement.mjs';

const good={captured:true,status:'passed',coverage:'detailed',
  summary:'기업의 업무 자료를 정리하고 여러 담당자가 함께 이용하는 소프트웨어를 판매하는 회사예요.',
  customers:'여러 부서에서 같은 업무 정보를 이용해야 하는 기업이 고객이에요. 자료를 한곳에서 관리할 때 사용해요.',
  revenue:'고객이 서비스를 사용하는 기간과 기능에 따라 이용 요금을 받아요. 요금과 이용 고객 수가 수입에 영향을 줘요.',
  watch:'새 고객이 얼마나 늘었는지와 기존 고객이 계속 사용하는지 확인해요. 서비스를 제공하는 비용도 함께 봐요.',
  sources:[{label:'가상의 공식 자료 fixture',url:'https://company.example/annual-report'}]};
const screen={captured:true,kind:'company',coverage:'detailed',summary:good.summary,entryLabel:'산업 알아보기',navigation:'passed',terms:{captured:true,expected:[],linked:[],probes:[]}};
const questions={captured:true,paths:[{titles:['어떻게 돈을 버나요?'],answer:good.revenue,next:[],status:'passed'}]};
const row=(company=good,overrides={})=>normalizeReview({symbol:'TEST',businessLevel:'detailed',sourceCount:1,
  sections:{'회사 이해':good.summary,'거래일 브리핑':'최근 소식의 시점과 출처를 확인해요.','배우기':'일반 개념 자료실'},
  companyExplanation:company,explanation:screen,questionPaths:questions,...overrides});

test('a present detailed explanation can still need content work even when screen clicks work',()=>{
  const run=buildRun([row({...good,customers:'',revenue:'',sources:[]})]);
  for(const rule of ['business-content-incomplete','business-content-unsourced'])assert(run.backlog.some(f=>f.rule===rule));
  assert.equal(run.cases[0].explanationStatus.screen,'observed');
  assert.equal(run.cases[0].explanationStatus.content,'needs-work');
  assert.equal(run.cases[0].explanationStatus.completed,false);
});
test('API summary-only static profiles do not imply that hidden UI business chapters are missing',()=>{
  const run=buildRun([row(undefined,{companyExplanation:null,network:[{url:'https://joobi.kr/api/company-profile?symbol=TEST',status:200,
    body:{data:{business:{level:'detailed',summary:good.summary,sources:good.sources}}}}]})]);
  assert.equal(run.cases[0].explanationStatus.content,'unassessed');
  assert(!run.backlog.some(f=>f.rule==='business-content-incomplete'));
});
test('old and partial captures cannot silently pass either side of joint review',()=>{
  const old=buildRun([row(null,{explanation:null,questionPaths:null})]).cases[0];
  assert.equal(old.explanationStatus.overall,'unassessed');
  const partial=buildRun([row({...good,status:'inconclusive',revenue:''})]).cases[0];
  assert.equal(partial.explanationStatus.content,'unassessed');
  assert(!partial.findings.some(f=>f.rule==='business-content-incomplete'));
  const incomplete=buildRun([row({...good,status:'inconclusive'})]);
  assert.equal(incomplete.companyExplanationCoverage.captured,0);
  assert.deepEqual(incomplete.companyExplanationCoverage.unassessed,['TEST']);
});
test('observable content and working screens still require source meaning review and user understanding',()=>{
  const status=buildRun([row()]).cases[0].explanationStatus;
  assert.equal(status.overall,'review-pending');assert.equal(status.completed,false);
  assert.equal(status.semanticReview,'pending');assert.equal(status.userUnderstanding,'unmeasured');
  assert.equal(buildRun([row(good,{questionPaths:null})]).cases[0].explanationStatus.screen,'unassessed');
});
test('repeated and abstract business text asks for editing, not an AI-authorship verdict',()=>{
  const run=buildRun([row({...good,revenue:good.customers,watch:'여러 맥락을 탐색하고 인사이트를 도출하며 투자 상황을 다각도로 조망하는 내용이에요.'})]);
  for(const rule of ['business-content-repeated','business-content-language-review'])
    assert.equal(run.cases[0].findings.find(f=>f.rule===rule).confidence,'needs-semantic-review');
});
test('content evidence changes invalidate earlier matching assessments and ignore injected approvals',()=>{
  const a=buildRun([row()]),b=buildRun([row({...good,revenue:'제품의 이용 기간에 따라 정한 요금을 받는 방식으로 수입을 얻어요.'})]);
  assert.notEqual(a.cases[0].contentHash,b.cases[0].contentHash);
  const value=normalizeCompanyExplanation({...good,secret:'private-token',truthVerified:true,headers:{Authorization:'private-token'},sources:[...good.sources,{url:'https://user:password@company.example/private'}]});
  assert(!JSON.stringify(value).includes('private-token'));assert(!JSON.stringify(value).includes('password'));
  assert(!JSON.stringify(value).includes('truthVerified'));
});
test('existing content issues create durable editing work without model generation requests',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-company-content-'));
  try {
    const run=buildRun([row({...good,revenue:''})]);
    await reconcileImprovements(run,{root});await reconcileImprovements(run,{root});
    const tasks=await listImprovements(root);
    assert.equal(tasks.length,1);assert.equal(tasks[0].kind,'company-content-review');
    assert.equal(tasks[0].observations.length,1);assert.equal(repairManifest(run).requests.length,0);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('fund structures never inherit a company customer/revenue completeness verdict',()=>{
  const run=buildRun([row({...good,revenue:'',sources:[]},{explanation:{...screen,kind:'fund',scope:'산업 예시는 실제 구성 목록과 구분해요.'}})]);
  assert(!run.backlog.some(f=>f.rule.startsWith('business-content-')));
  assert.equal(run.cases[0].explanationStatus.contentKind,'fund');
});
