import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReview, buildRun, analyze, validateAssessment, compareRuns, RUBRIC, RUBRIC_HASH } from '../src/engine.mjs';

const fixture=(symbol='TEST',overrides={})=>normalizeReview({symbol,name:'테스트 회사',checkedAt:'2026-11-01T00:00:00Z',
  sections:{'회사 이해':'이 회사는 가입 고객에게 서비스를 제공하고 요금을 받아요.','거래일 브리핑':'회사 발표에서 이번 분기 실적과 기준 기간을 확인했어요.','배우기':'구독 고객 수와 요금은 어떻게 달라졌나요?'},
  screenshots:['a'.repeat(64)+'.png'],businessLevel:'summary',newsCount:1,...overrides});
const assessment=row=>({symbol:row.symbol,reviewer:'검사 fixture',kind:'model',rubricHash:RUBRIC_HASH,contentHash:row.contentHash,evidenceHash:row.evidenceHash,
  axes:Object.fromEntries(RUBRIC.axes.map(a=>[a.id,{score:a.max,reason:'테스트용 검토 근거',evidence:a.id==='design'?[{id:row.evidence.find(e=>e.kind==='screenshot').id}]:[{id:row.evidence[0].id,quote:row.evidence[0].value}]}])),trust:{status:'unreviewed',reason:'원문 검증 전'}});

test('주식 매입 계약 종료를 납품으로 연결한 실제 발견 패턴은 치명적',()=>{
  const x=fixture('ALLR');x.sections['거래일 브리핑']='Allarity, 600만 달러 주식 매입 계약 종료\n큰 계약을 따면 당장 돈이 들어오나요? →\n납품 시기를 확인해요.';
  assert.equal(analyze([x])[0].findings.find(f=>f.rule==='financing-as-sales').severity,'critical');
});
test('공급 계약의 납품 설명을 같은 오류로 오탐하지 않음',()=>{
  const x=fixture();x.sections['거래일 브리핑']='제품 공급 계약 체결\n납품 시기를 확인해요.';
  assert(!analyze([x])[0].findings.some(f=>f.rule==='financing-as-sales'));
});
test('표본 내 반복 질문을 감지하지만 질문 하나를 반복으로 단정하지 않음',()=>{
  assert(!analyze([fixture()])[0].findings.some(f=>f.rule==='question-repeated'));
  assert.equal(analyze(['A','B','C'].map(s=>fixture(s))).filter(r=>r.findings.some(f=>f.rule==='question-repeated')).length,3);
});
test('일반 개념으로 명시한 자료를 회사 맞춤 질문 반복으로 계산하지 않음',()=>{
  const rows=['A','B','C'].map(symbol=>fixture(symbol,{learningSuggestion:{kind:'general-concept',title:'매출과 이익의 차이'}}));
  assert(rows.every(row=>row.generalConcept==='매출과 이익의 차이'));
  assert(!analyze(rows).some(row=>row.findings.some(f=>f.rule==='question-repeated')));
});
test('물음표를 없애도 여러 기사에 같은 개념 링크를 반복한 문제를 놓치지 않음',()=>{
  const x=fixture();x.sections['거래일 브리핑']='기사 A\n관련 개념 · 기사 속 숫자의 출처 확인하기 →\n기사 B\n관련 개념 · 기사 속 숫자의 출처 확인하기 →';
  assert(analyze([x])[0].findings.some(f=>f.rule==='repeated-news-link'));
  x.sections['거래일 브리핑']='기사 A\n관련 개념 · 기사 속 숫자의 출처 확인하기 →\n기사 B\n관련 개념 · 배당수익률을 볼 때 확인할 것 →';
  assert(!analyze([x])[0].findings.some(f=>f.rule==='repeated-news-link'));
});
test('가정과 과거 결과가 섞인 질문은 문맥 검토로 남기며 AI 작성이나 사실 오류로 단정하지 않음',()=>{
  const x=fixture();x.sections['배우기']='매출이 늘면 이익도 늘었을까요?';
  const finding=analyze([x])[0].findings.find(f=>f.rule==='question-tense-review');
  assert.equal(finding.confidence,'needs-semantic-review');assert.equal(finding.severity,'minor');
  for(const title of ['매출과 이익의 차이','매출이 늘면 이익도 늘까요?','매출과 이익은 얼마나 늘었나요?']){
    x.sections['배우기']=title;assert(!analyze([x])[0].findings.some(f=>f.rule==='question-tense-review'));
  }
});
test('수집하지 못한 종목을 실패로 남김',()=>assert(analyze([fixture('A',{sections:{}})])[0].findings.some(f=>f.rule==='capture-failed')));
test('중복 티커로 표본을 부풀릴 수 없음',()=>assert.throws(()=>buildRun([fixture(),fixture()]),/invalid_sample/));
test('공개 표본 정규화가 auth 및 관련 없는 응답을 버림',()=>{
  const x=fixture('A',{authorization:'secret',detail:'계좌번호',network:[{url:'https://joobi.kr/api/private',body:{token:'secret'}}]});
  assert(!JSON.stringify(x).includes('secret'));assert(!JSON.stringify(x).includes('계좌번호'));
});
test('없던 문장을 인용하면 채점 거절',()=>{const row=analyze([fixture()])[0],a=assessment(row);a.axes.flow.evidence[0].quote='원문에 없는 문장입니다';assert.throws(()=>validateAssessment(row,a),/unmatched_quote/);});
test('글은 같아도 화면이 달라졌다면 이전 디자인 평가 재사용 불가',()=>{
  const before=analyze([fixture()])[0],after=analyze([fixture('TEST',{screenshots:['b'.repeat(64)+'.png']})])[0];
  assert.equal(before.contentHash,after.contentHash);assert.throws(()=>validateAssessment(after,assessment(before)),/stale_assessment/);
});
test('디자인 점수는 실제 화면 증거가 필요',()=>{const row=analyze([fixture()])[0],a=assessment(row);a.axes.design.evidence=a.axes.flow.evidence;assert.throws(()=>validateAssessment(row,a),/design_requires_screen/);});
test('원문 검증 체인 없이 사실 검증 완료를 자칭할 수 없음',()=>{const row=analyze([fixture()])[0],a=assessment(row);a.trust.status='verified';assert.throws(()=>validateAssessment(row,a),/primary_source_review_not_connected/);});
test('100점이어도 신뢰 실패는 반영 차단',()=>{
  const before=buildRun([fixture()]),after=buildRun([fixture()]);
  for(const run of [before,after]) {const row=run.cases[0],a=assessment(row);a.trust={status:'failed',reason:'주장과 맥락 충돌',evidence:a.axes.flow.evidence};row.assessment=validateAssessment(row,a);}
  const result=compareRuns(before,after);assert.equal(result.critical,true);assert.match(result.decision,/반영 차단/);assert.equal(result.deploymentApproved,false);
});
test('미검증은 고득점이어도 합격이 아님',()=>{
  const run=buildRun([fixture()]);run.cases[0].assessment=validateAssessment(run.cases[0],assessment(run.cases[0]));
  assert.equal(compareRuns(run,run).decision,'사실 근거 검증 필요');
});
test('평가 기준 변경은 점수 상승으로 비교하지 않음',()=>{
  const a=buildRun([fixture()]),b=structuredClone(a);b.rubricHash='new';assert.equal(compareRuns(a,b).comparable,false);
});
test('표본 교체는 동일 사례 개선으로 인정하지 않음',()=>assert.equal(compareRuns(buildRun([fixture('A')]),buildRun([fixture('B')])).comparable,false));
test('수집기 수정으로 생긴 차이를 제품 개선으로 세지 않음',()=>{
  const a=buildRun([fixture()]),b=structuredClone(a);b.captureVersion='new';assert.equal(compareRuns(a,b).comparable,false);
});
test('잘못 수집한 기록은 보존하되 개선 점수에서 제외',()=>{
  const a=buildRun([fixture()]),b=structuredClone(a);b.annotation={invalidated:true};
  assert.equal(compareRuns(a,b).comparable,false);assert.equal(compareRuns(a,b).decision,'검사 오류 · 비교에서 제외');
});
