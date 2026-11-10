import { createHash } from 'node:crypto';
import { normalizeExplanation, explanationFindings, EXPLANATION_POLICY } from './explanation.mjs';
import { normalizeQuestionPaths, questionPathFindings } from './question-paths.mjs';
import { normalizeCompanyExplanation, companyExplanationFindings, jointExplanationStatus, COMPANY_EXPLANATION_POLICY } from './company-explanation.mjs';

export const ENGINE_VERSION = '0.6.0';
export const RUBRIC = Object.freeze({
  id: 'joobi-reader-v3',
  axes: [
    { id: 'flow', label: '논리 흐름', max: 20, anchors: ['문맥 없이 이동', '일부 연결', '회사 → 사건 → 의미 → 다음 질문이 연결됨'] },
    { id: 'evidence', label: '근거와 쓸모', max: 25, anchors: ['회사 설명·근거 없음', '부분 사실과 출처', '사업·고객·수익·점검 내용과 시점·범위를 원문으로 대조한 실질적 답변'] },
    { id: 'language', label: '구체적인 말투', max: 15, anchors: ['모르는 용어·추상적인 문장', '뜻풀이·예시가 부분적으로 연결됨', '처음 보는 용어의 뜻과 문맥을 쉽게 확인하며 불필요한 반복 없음'] },
    { id: 'design', label: '디자인·사용성', max: 20, anchors: ['읽거나 이동하기 어려움', '기능은 동작하나 위계·빈 상태 미흡', '주비 언어에 맞는 위계·가독성·탐색'] },
    { id: 'curiosity', label: '이어지는 이해', max: 20, anchors: ['답 없는 질문 또는 막다른 길', '관련 개념으로 연결', '현재 사실에서 나온 질문에 근거 있는 답과 다음 맥락 제공'] },
  ],
  note: '전문가의 화면 평가. 사용자 만족도·이해도·재방문율 측정값이 아님. 자동 탐지는 총점을 대신하지 않음.',
  objective:'초보자가 용어와 사건을 이해하고 자신의 투자와 연결해, 점차 스스로 자료를 읽고 판단하도록 돕는다. 미방문을 학습 완료로 간주하지 않는다.',
});
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const RUBRIC_HASH = digest(RUBRIC);
export const validSymbol = value => typeof value === 'string' && /^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(value);
const text = value => typeof value === 'string' ? value.slice(0,60000) : '';
export function normalizeReview(raw) {
  if (!validSymbol(raw.symbol)) throw Error('invalid_symbol');
  const sections = Object.fromEntries(['회사 이해','거래일 브리핑','배우기'].map(k => [k,text(raw.sections?.[k])]));
  // Only public section text and selected public API fields. Never copy raw requests,
  // headers, auth, user state, arbitrary network bodies, or the full account dialog.
  const responses = (raw.network ?? []).filter(r => {
    try { const u = new URL(r.url); return ['/api/company-profile','/api/news','/api/stock-daily-brief'].includes(u.pathname) && u.searchParams.get('symbol') === raw.symbol; }
    catch { return false; }
  });
  const profile = responses.find(r => new URL(r.url).pathname === '/api/company-profile');
  const news = responses.find(r => new URL(r.url).pathname === '/api/news');
  return {
    symbol:raw.symbol, name:text(raw.identity?.description || raw.name || raw.symbol), market:raw.market,
    checkedAt:raw.checkedAt, sections, overflow:raw.overflow ?? null,
    failure:raw.failure ? text(raw.failure).slice(0,500) : Object.values(sections).some(s=>!s.trim())?'필수 화면 수집이 누락됨':null,
    errorCount:(raw.pageErrors ?? []).length, screenshots:raw.screenshots ?? [],
    businessLevel:profile?.body?.data?.business?.level ?? raw.businessLevel ?? 'unknown',
    businessVersion:typeof profile?.body?.data?.business?.version==='string' ? profile.body.data.business.version.slice(0,80) : raw.businessVersion ?? null,
    sourceCount:profile?.body?.data?.business?.sources?.length ?? raw.sourceCount ?? null,
    newsStatus:news ? news.status>=400?'unavailable':news.body?._meta?.status==='unavailable'?'unavailable':Array.isArray(news.body?.items)?news.body.items.length?'ok':'empty':'unknown' : raw.newsStatus ?? 'unknown',
    newsSearchIncomplete:news?.body?._meta?.attempts?.some?.(a=>a.status==='unavailable') && !news.body?.items?.length || raw.newsSearchIncomplete === true,
    newsCount:Array.isArray(news?.body?.items) ? news.body.items.length : raw.newsCount ?? null,
    navigation:raw.navigation ?? null,
    explanation:normalizeExplanation(raw.explanation),
    companyExplanation:normalizeCompanyExplanation(raw.companyExplanation),
    questionPaths:normalizeQuestionPaths(raw.questionPaths),
    question: raw.learningSuggestion?.kind==='general-concept' ? null : sections['배우기'].split('\n').map(v=>v.trim()).find(v=>v.endsWith('?')) ?? null,
    generalConcept: raw.learningSuggestion?.kind==='general-concept' ? text(raw.learningSuggestion.title).slice(0,180) : null,
  };
}
export function evidenceFor(row) {
  const refs = Object.entries(row.sections).filter(([,v])=>v).map(([section,value])=>({id:`${row.symbol}:text:${section}`,kind:'text',section,value}));
  if(row.explanation) refs.push({id:`${row.symbol}:text:explanation`,kind:'text',section:'설명 탐색',value:JSON.stringify(row.explanation)});
  if(row.questionPaths) refs.push({id:`${row.symbol}:text:question-paths`,kind:'text',section:'질문 경로',value:JSON.stringify(row.questionPaths)});
  if(row.companyExplanation) refs.push({id:`${row.symbol}:text:company-explanation`,kind:'text',section:'기업 설명 본문',value:JSON.stringify(row.companyExplanation)});
  for (let i=0;i<row.screenshots.length;i++) refs.push({id:`${row.symbol}:screen:${i}`,kind:'screenshot',value:row.screenshots[i]});
  return refs;
}
const recommendations = {
  'news-unavailable': ['기사 조회가 실패함','조회 실패와 실제 빈 검색 결과를 구분하고 원천과 재시도 경로 확인','정상 공급 응답과 날짜·종목 일치 기사, 화면 재시도 확인'],
  'news-search-incomplete': ['검색 실패를 기사 없음으로 표시할 위험','일부 검색 경로 실패 시 빈 결과 확정을 중단','불완전 조회를 정상 빈 결과로 저장하지 않고 복구 후 다시 확인'],
  'financing-as-sales': ['자금 조달 계약을 납품·매출 계약처럼 연결함','계약의 당사자·목적·진행 단계를 식별한 뒤 설명 연결','주식 매입 계약 종료 사례를 수주 성공·납품으로 연결하면 차단'],
  'business-missing': ['사업 설명이 비어 있음','검증된 발행사 자료에서 무엇을 팔고 누구에게 돈을 받는지 채우기','회사명·발행사 일치, 출처·확인일, 고객·수익 구조가 화면에서 확인돼야 함'],
  'business-thin': ['등록 제품명만으로 회사 소개를 대신함','제품 목록을 출처가 있는 사업 설명으로 확장','사업·고객·수익 구조를 근거와 함께 설명하고 기존 사실을 보존'],
  'question-repeated': ['다른 회사에도 같은 첫 질문이 반복됨','확인된 사건에 연결된 질문과 답을 만들고 일반 학습은 별도로 표시','회사·사건별 질문에 답할 근거가 있어야 하며 무작위 문구 교체로 통과하지 않음'],
  'context-without-news': ['관련 자료가 없는데 회사 맞춤 질문처럼 보임','일반 개념과 회사별 해설의 이름·배치 구분','자료 없는 상태에서 회사나 최근 기사에 근거한 해설이라고 표시하지 않음'],
  'generic-watch': ['다음 확인 항목이 회사·사건과 연결되지 않음','사건의 현재 단계와 다음 확인할 발표를 연결','신청/승인/공급 등 단계를 혼동하지 않고 실제 확인 경로 제공'],
  'repeated-news-link': ['서로 다른 기사에 같은 질문을 반복함','기사별로 유용한 답이 있는 경우에만 후속 질문 노출','제목 키워드 하나로 같은 개념을 반복 배치하지 않음'],
  'capture-failed': ['화면 수집 실패','실패를 표본에 남기고 원인 확인 후 재검사','실패 종목을 다른 종목으로 교체해 통과율을 높이지 않음'],
  'layout-overflow': ['가로 영역이 넘침','좁은 화면에서 제목·탭·본문 배치 조정','동일 화면 크기에서 내용·초점·스크롤 접근 검증'],
  'navigation-failed': ['질문에서 답변 또는 돌아오기가 동작하지 않음','질문 → 답변 → 이전 위치 경로 수정','동일 질문으로 실제 클릭과 복귀 성공'],
  'question-tense-review': ['질문의 시제와 전제 점검 필요','가정과 실제 결과를 섞거나 정답을 맞히게 하는 문장을 문맥과 함께 검토','일반 개념은 내용을 직접 밝히고, 실제 결과를 전제하는 질문은 해당 근거와 함께 제공'],
};
export function analyze(rows) {
  const counts = new Map();
  for (const row of rows) if(row.question) counts.set(row.question,(counts.get(row.question)??0)+1);
  return rows.map(row => {
    const refs=evidenceFor(row), findings=[];
    const add=(rule,section,severity='major',confidence='observed')=> {
      const [title,proposal,acceptance]=recommendations[rule];
      findings.push({id:`${row.symbol}:${rule}`,rule,title,proposal,acceptance,severity,confidence,
        evidenceIds:refs.filter(e=>e.kind==='text'&&(!section||e.section===section)).map(e=>e.id)});
    };
    if(row.failure) add('capture-failed',null,'critical');
    if(row.newsStatus==='unavailable')add('news-unavailable','거래일 브리핑');
    if(row.newsSearchIncomplete)add('news-search-incomplete','거래일 브리핑');
    const company=row.sections['회사 이해'];
    if(row.explanation?.kind!=='fund' && (row.businessLevel==='missing'||/사업 소개는.*준비되지|확인된 사업 설명이 없/.test(company))) add('business-missing','회사 이해');
    else if(row.explanation?.kind!=='fund' && (row.businessLevel==='products'||/거래소에 등록된 주요 제품/.test(company))) add('business-thin','회사 이해');
    if((counts.get(row.question)??0)>=3) add('question-repeated','배우기','major','cross-sample');
    if(row.newsCount===0 && /이 회사에서 이어지는 궁금증/.test(row.sections['배우기'])) add('context-without-news','배우기','major','needs-semantic-review');
    if(/다음 공시나 실적 자료가 나오면 매출·이익·현금흐름/.test(row.sections['거래일 브리핑'])) add('generic-watch','거래일 브리핑','major','needs-semantic-review');
    const questions=row.sections['거래일 브리핑'].split('\n').map(l=>l.trim()).filter(l=>/\?\s*→$|^관련 개념 ·.+→$/.test(l));
    if(/주식 매입 계약 종료/.test(row.sections['거래일 브리핑']) && /납품 시기|큰 계약을 따면/.test(row.sections['거래일 브리핑'])) add('financing-as-sales','거래일 브리핑','critical');
    if(questions.length>=2 && new Set(questions).size<questions.length) add('repeated-news-link','거래일 브리핑','major','needs-semantic-review');
    if(row.overflow===true) add('layout-overflow',null);
    if(row.navigation?.status==='failed') add('navigation-failed','배우기','critical');
    // A review cue, never a claim that AI wrote the sentence or a factual verdict.
    for(const [section,body] of Object.entries(row.sections)) {
      if(/(?:늘면|줄면|오르면|내리면)[^\n?.]{0,36}(?:늘었을까요|줄었을까요|올랐을까요|내렸을까요)\?/.test(body)) {
        add('question-tense-review',section,'minor','needs-semantic-review');break;
      }
    }
    for(const finding of explanationFindings(row)) findings.push({id:`${row.symbol}:${finding.rule}`,...finding,confidence:'observed',
      evidenceIds:refs.filter(e=>e.section==='설명 탐색').map(e=>e.id)});
    for(const finding of questionPathFindings(row)) findings.push({id:`${row.symbol}:${finding.rule}`,...finding,
      evidenceIds:refs.filter(e=>e.section==='질문 경로').map(e=>e.id)});
    for(const finding of companyExplanationFindings(row)) findings.push({id:`${row.symbol}:${finding.rule}`,...finding,
      evidenceIds:refs.filter(e=>e.section==='기업 설명 본문').map(e=>e.id)});
    return {...row,contentHash:digest([row.sections,row.explanation,row.questionPaths,row.companyExplanation]),evidenceHash:digest([refs,row.navigation,row.overflow]),evidence:refs,findings,
      explanationStatus:jointExplanationStatus(row,findings)};
  });
}
export function validateAssessment(row, assessment) {
  if(assessment.rubricHash!==RUBRIC_HASH || assessment.contentHash!==row.contentHash || assessment.evidenceHash!==row.evidenceHash) throw Error('stale_assessment');
  if(!['expert','model'].includes(assessment.kind)||!text(assessment.reviewer).trim()) throw Error('missing_reviewer');
  const ref=new Map(row.evidence.map(e=>[e.id,e]));
  for(const axis of RUBRIC.axes) {
    const a=assessment.axes?.[axis.id];
    if(!a||!Number.isInteger(a.score)||a.score<0||a.score>axis.max||!text(a.reason).trim()||!a.evidence?.length) throw Error(`invalid_axis:${axis.id}`);
    for(const e of a.evidence) {
      const stored=ref.get(e.id);
      if(!stored) throw Error('unknown_evidence');
      if(stored.kind==='text' && (typeof e.quote!=='string'||e.quote.trim().length<6||!stored.value.includes(e.quote))) throw Error('unmatched_quote');
    }
    if(axis.id==='design'&&!a.evidence.some(e=>ref.get(e.id)?.kind==='screenshot')) throw Error('design_requires_screen');
  }
  if(!['unreviewed','failed','verified'].includes(assessment.trust?.status)) throw Error('trust_verdict_required');
  // V0 has no captured primary-source review chain. A self-attested "verified"
  // flag cannot turn quotes from our own UI into proof of factual correctness.
  if(assessment.trust.status==='verified') throw Error('primary_source_review_not_connected');
  if(assessment.trust.status!=='unreviewed' && (!text(assessment.trust.reason).trim()||!assessment.trust.evidence?.length)) throw Error('trust_evidence_required');
  for(const e of assessment.trust.evidence??[]) {
    const stored=ref.get(e.id);
    if(!stored||stored.kind!=='text'||typeof e.quote!=='string'||e.quote.trim().length<6||!stored.value.includes(e.quote)) throw Error('invalid_trust_evidence');
  }
  return {...assessment,total:RUBRIC.axes.reduce((n,a)=>n+assessment.axes[a.id].score,0),
    note:assessment.kind==='model'?'모델 제안 점수 · 독립 검수 전':'전문가 화면 평가 · 사용자 행동 측정 아님'};
}
export function buildRun(rows, meta={}) {
  if(!rows.length||new Set(rows.map(r=>r.symbol)).size!==rows.length) throw Error('invalid_sample');
  const cases=analyze(rows);
  const run={schemaVersion:1,engineVersion:ENGINE_VERSION,rubric:RUBRIC,rubricHash:RUBRIC_HASH,
    createdAt:new Date().toISOString(),...meta,cases};
  run.explanationCoverage={policy:EXPLANATION_POLICY,captured:cases.filter(r=>r.explanation).length,total:cases.length,
    unassessed:cases.filter(r=>!r.explanation).map(r=>r.symbol),note:'전달·탐색 자동 검사. 의미·사실 검수와 사용자 이해도는 별도.'};
  run.questionPathCoverage={policy:'question-paths-v1',captured:cases.filter(r=>r.questionPaths).length,total:cases.length,
    unassessed:cases.filter(r=>!r.questionPaths).map(r=>r.symbol),semanticReview:'pending',userUnderstanding:'unmeasured'};
  run.companyExplanationCoverage={policy:COMPANY_EXPLANATION_POLICY,captured:cases.filter(r=>r.companyExplanation?.status==='passed').length,
    unassessed:cases.filter(r=>r.explanation?.kind!=='fund'&&r.companyExplanation?.status!=='passed').map(r=>r.symbol),
    note:'화면의 사업·고객·수익·점검 본문을 수집. 원문 대조와 사용자 이해 확인은 별도.'};
  run.sampleHash=digest(cases.map(r=>r.symbol).sort());
  run.id=digest([run.createdAt,run.sampleHash,cases.map(r=>r.contentHash)]).slice(0,20);
  const groups=cases.flatMap(r=>r.findings.map(f=>({...f,symbol:r.symbol}))).reduce((acc,f)=>{(acc[f.rule]??=[]).push(f);return acc;},{});
  run.backlog=Object.entries(groups).map(([rule,items])=>({
    rule,title:items[0].title,proposal:items[0].proposal,acceptance:items[0].acceptance,
    affected:items.map(f=>f.symbol),priority:items.some(f=>f.severity==='critical')?'P0':'P1',
    evidence:items.flatMap(f=>f.evidenceIds),status:'open',
  })).sort((a,b)=>a.priority.localeCompare(b.priority)||b.affected.length-a.affected.length);
  return run;
}
export function compareRuns(before,after) {
  const reasons=[];
  const invalidated=before.annotation?.invalidated||after.annotation?.invalidated;
  if(invalidated) reasons.push('수집기 오류로 사용 중단한 기록 포함');
  if(before.sampleHash!==after.sampleHash) reasons.push('표본이 다름');
  if(before.rubricHash!==after.rubricHash) reasons.push('평가 기준이 다름: 같은 기준으로 다시 채점 필요');
  if(before.engineVersion!==after.engineVersion) reasons.push('탐지 엔진 버전이 다름: 같은 엔진으로 재평가 필요');
  if(before.captureVersion!==after.captureVersion) reasons.push('화면 수집기 버전이 다름: 동작 판정 대조 필요');
  if(before.cases.some(r=>!r.assessment)||after.cases.some(r=>!r.assessment)) reasons.push('미채점 화면 있음');
  const scoreReady=reasons.length===0;
  const deltas=after.cases.map(row=>{
    const prev=before.cases.find(p=>p.symbol===row.symbol);
    return {symbol:row.symbol,delta:scoreReady?row.assessment.total-prev.assessment.total:null,
      regression:scoreReady?RUBRIC.axes.some(a=>row.assessment.axes[a.id].score<prev.assessment.axes[a.id].score):null};
  });
  const trustFailed=after.cases.some(r=>r.assessment?.trust?.status==='failed');
  const trustPending=after.cases.some(r=>r.assessment?.trust?.status!=='verified');
  const critical=trustFailed||after.cases.some(r=>r.findings.some(f=>f.severity==='critical'));
  return {comparable:scoreReady,reasons,deltas,critical,
    sameContent:before.cases.every(p=>after.cases.find(r=>r.symbol===p.symbol)?.contentHash===p.contentHash),
    decision:invalidated?'검사 오류 · 비교에서 제외':critical?'신뢰·동작 결함으로 반영 차단':!scoreReady?'평가 미완료':trustPending?'사실 근거 검증 필요':deltas.some(r=>r.regression)?'회귀 검토 필요':'개선 후보 검토 가능',
    deploymentApproved:false,note:'실시간 자료 변화와 코드 효과는 별도 대조해야 함. 이 비교는 자동 배포 승인이 아님.'};
}
