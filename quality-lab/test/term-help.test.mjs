import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReview,buildRun} from '../src/engine.mjs';
import {normalizeTermHelp,expectedTermHelp} from '../src/term-help.mjs';
const run=terms=>buildRun([normalizeReview({symbol:'SOXL',sections:{'회사 이해':'ETF의 기초지수 설명','거래일 브리핑':'소식','배우기':'질문'},explanation:{captured:true,kind:'fund',summary:'하루 목표 상품',entryLabel:'반도체',scope:'산업 예시',navigation:'passed',terms}})]);
test('the named index and the exchange need separate help only when both actually appear',()=>{
  assert.deepEqual(expectedTermHelp('NYSE 반도체지수를 따르는 ETF의 기초지수'),['etf','benchmark','nyse-semiconductor']);
  assert.deepEqual(expectedTermHelp('NYSE 반도체지수와 NYSE의 차이'),['nyse-semiconductor','nyse']);
  assert.deepEqual(expectedTermHelp('ETFX와 ABCNYSE라는 이름'),[]);
});
test('terms appearing as plain jargon without help create an improvement finding',()=>{
  assert(run({captured:true,expected:['etf','benchmark'],linked:[],probes:[]}).backlog.some(f=>f.rule==='explanation-term-link-missing'));
});
test('links alone do not pass an attempted but broken definition dialog',()=>{
  assert(run({captured:true,expected:['etf'],linked:['etf'],probes:[{id:'etf',status:'inconclusive'}]}).backlog.some(f=>f.rule==='explanation-term-dialog-unverified'));
});
test('definition evidence is bounded and excludes credentials and self-approved truth',()=>{
  const normalized=normalizeTermHelp({captured:true,expected:['etf'],linked:['etf'],secret:'private',probes:[{id:'etf',status:'passed',definition:'공식 뜻과 예시',truthVerified:true}]});
  assert(!JSON.stringify(normalized).includes('private'));assert(!JSON.stringify(normalized).includes('truthVerified'));
  assert.deepEqual(normalizeTermHelp({captured:true,expected:'bad',linked:1,probes:null}).expected,[]);
});
