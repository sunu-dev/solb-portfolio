import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReview,buildRun} from '../src/engine.mjs';
const row=paths=>normalizeReview({symbol:'SOXL',sections:{'회사 이해':'상품 구조','거래일 브리핑':'최근 소식','배우기':'질문과 설명'},questionPaths:{captured:true,paths}});
const path=(title,answer,next=[])=>({titles:Array.isArray(title)?title:[title],answer,next,status:'passed'});
test('a clicked path remains pending semantic review and is not a user-understanding score',()=>{
  const run=buildRun([row([path('하루 3배의 뜻','매일 달라진 자산에서 다시 목표 배수를 맞추는 구조예요.')])]);
  assert.equal(run.cases[0].questionPaths.semanticReview,'pending');
  assert.equal(run.cases[0].questionPaths.userUnderstanding,'unmeasured');
});
test('a glossary that fails inside a later answer stays in the improvement backlog',()=>{
  const run=buildRun([row([{...path(['첫 질문','다음 질문'],'NYSE는 미국 뉴욕증권거래소의 영어 약자예요.'),terms:{captured:true,expected:['nyse'],linked:['nyse'],probes:[{id:'nyse',status:'inconclusive'}]}}])]);
  assert(run.backlog.some(x=>x.rule==='question-term-dialog-unverified'));
});
test('different questions with identical complete answers trigger review, not a truth verdict',()=>{
  const same='이 상품은 매일 투자 규모를 조정하며 여러 날 수익률은 단순 배수와 달라요.';
  const run=buildRun([row([path('첫 질문',same),path('다른 질문',same)])]);
  assert(run.backlog.some(x=>x.rule==='question-answer-repeated'));
});
test('captures empty answers, loops and abstract wording as separate review evidence',()=>{
  const run=buildRun([row([path(['투자 대상','수익 구조'],'맥락을 탐색하고 인사이트를 도출하는 과정이라고 할 수 있어요.',['투자 대상']),{titles:['빈 답'],answer:'',status:'inconclusive'}])]);
  for(const rule of ['question-path-incomplete','question-path-backtrack','question-language-review'])assert(run.backlog.some(x=>x.rule===rule));
});
test('ignores unobserved paths and extra fields and keeps evidence fingerprints sensitive to changed answers',()=>{
  const raw=row(undefined);assert.equal(raw.questionPaths.paths.length,0);
  const a=buildRun([row([path('질문','하루 목표는 비용을 빼기 전 기준이며 달성이 보장되지 않아요.')])]);
  const b=buildRun([row([path('질문','장기간의 수익률도 언제나 정확하게 세 배가 된다고 설명해요.')])]);
  assert.notEqual(a.cases[0].contentHash,b.cases[0].contentHash);
});
