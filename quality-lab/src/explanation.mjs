/** Observable delivery checks, never an automated verdict on financial truth. */
import {normalizeTermHelp} from './term-help.mjs';
export const EXPLANATION_POLICY = 'instrument-explanation-v1';
const clip = (value, max=600) => typeof value==='string' ? value.slice(0,max) : '';
export function normalizeExplanation(raw) {
  if (!raw || raw.captured!==true) return null;
  return {
    captured:true, kind:['fund','company'].includes(raw.kind)?raw.kind:'unknown',
    coverage:clip(raw.coverage,30), summary:clip(raw.summary),
    entryLabel:clip(raw.entryLabel,300), scope:clip(raw.scope), daily:clip(raw.daily),
    multiple:Number.isFinite(raw.multiple)&&raw.multiple!==0?raw.multiple:null,
    terms:normalizeTermHelp(raw.terms),
    navigation:['passed','failed','inconclusive','missing'].includes(raw.navigation)?raw.navigation:'inconclusive',
  };
}
export function explanationFindings(row) {
  const x=row.explanation;
  if (!x) return [];
  const result=[];
  const add=(rule,title,proposal,acceptance,severity='major')=>result.push({rule,title,proposal,acceptance,severity});
  if (!x.summary.trim() || x.coverage==='missing') add('explanation-summary-missing','첫 설명이 없음','확인한 자료로 짧은 첫 설명 제공','회사·상품에 맞는 설명과 출처가 화면에 존재');
  if (x.summary.length>240) add('explanation-summary-long','첫 설명의 분량 검토 필요','핵심을 첫 문단에 두고 자세한 내용은 다음 단계로 이동','핵심 사실을 보존하며 초보자 읽기 검토', 'minor');
  if (!x.entryLabel.trim()) add('explanation-entry-missing','투자 대상·산업 탐색 입구 없음','상품은 투자 대상, 기업은 확인한 산업으로 연결','입구 → 설명 → 같은 입구 복귀를 실제 화면에서 확인');
  if (x.kind==='fund' && !x.scope.trim()) add('explanation-scope-missing','산업 탐색과 실제 구성의 범위 안내 없음','산업 기업 예시와 상품의 구성 종목·비중 구분','탐색 화면에 범위 설명이 실제로 표시');
  if (x.kind==='fund' && x.multiple!==null && !/하루|일일/.test(x.daily)) add('explanation-daily-missing','레버리지의 하루 기준 안내 없음','첫 설명 옆에 일일 목표와 누적 성과의 차이 설명','첫 화면에서 하루 기준·보장 아님·여러 날 성과 확인','critical');
  if (x.entryLabel && x.navigation!=='passed') add('explanation-navigation-unverified','투자 대상 탐색·복귀 미확인','실제 입구 클릭과 내용·복귀 검사','같은 종목에서 본문 표시와 입구 복귀 성공');
  if(x.terms?.expected.some(id=>!x.terms.linked.includes(id))) add('explanation-term-link-missing','어려운 용어에 뜻 설명 연결이 없음','본문에서 바로 용어 설명을 열도록 연결','ETF·기초지수·지수 이름의 뜻을 같은 화면에서 확인');
  if(x.terms?.probes.some(p=>p.status!=='passed')) add('explanation-term-dialog-unverified','용어 설명 열기·닫기 미확인','뜻·예시·출처와 읽던 위치 복귀 확인','실제 클릭으로 모달 내용과 닫기·초점 복귀 확인');
  return result;
}
