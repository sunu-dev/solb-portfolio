import { normalizeTermHelp } from './term-help.mjs';

export const COMPANY_EXPLANATION_POLICY='company-explanation-v1';
const fields=['summary','customers','revenue','watch'];
const clip=(value,max=2400)=>typeof value==='string'?value.slice(0,max):'';
function sourceUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href.slice(0,2000):'';} catch {return '';}
}
/** Keep the public prose actually rendered, not an API completeness assumption. */
export function normalizeCompanyExplanation(raw) {
  if(raw?.captured!==true)return null;
  return {captured:true,policy:COMPANY_EXPLANATION_POLICY,
    status:raw.status==='passed'?'passed':'inconclusive',
    coverage:['detailed','summary','products','missing','restricted'].includes(raw.coverage)?raw.coverage:'unknown',
    ...Object.fromEntries(fields.map(field=>[field,clip(raw[field])])),
    sources:(Array.isArray(raw.sources)?raw.sources:[]).slice(0,8).map(source=>({label:clip(source?.label,300),url:sourceUrl(source?.url)})).filter(source=>source.url),
    terms:normalizeTermHelp(raw.terms)};
}

export function companyExplanationFindings(row) {
  const x=row.companyExplanation;
  if(row.explanation?.kind==='fund'||x?.status!=='passed'||!['detailed','summary'].includes(x.coverage))return [];
  const result=[];
  const add=(rule,title,proposal,acceptance,severity='major',confidence='observed')=>result.push({rule,title,proposal,acceptance,severity,confidence});
  if(!x.summary.trim())add('business-content-summary-missing','제공 중인 회사 설명에 사업 요약이 없음','실제로 하는 일과 쓰임을 근거로 설명','회사 이름이나 업종명만으로 사업을 만들지 않고 본문 요약 확인');
  if(x.coverage==='detailed'&&['customers','revenue','watch'].some(field=>!x[field].trim()))
    add('business-content-incomplete','상세 회사 설명에 고객·수익·점검 내용 누락','접힌 상세 내용까지 읽고 누락된 실제 답 보완','고객과 필요·돈 버는 방식·확인할 점을 출처와 함께 제공');
  if(!x.sources.length)add('business-content-unsourced','회사 설명의 출처가 화면에 없음','사업 설명과 대조할 수 있는 원문 연결','같은 회사·기준 기간의 원문인지 별도 대조','critical');
  const bodies=fields.map(field=>x[field].replace(/\s+/g,' ').trim()).filter(value=>value.length>40);
  if(new Set(bodies).size<bodies.length)
    add('business-content-repeated','서로 다른 회사 설명 항목에 같은 답 반복','각 항목이 묻는 내용에 실제 답 제공','단순 문구 교체가 아니라 고객·매출·점검 항목의 차이를 검토','major','needs-semantic-review');
  if(bodies.some(body=>body.split(/(?<=[.!?。])\s+/u).some(sentence=>sentence.length>160)||/맥락을 탐색|인사이트를 도출|다각도로 조망/.test(body)))
    add('business-content-language-review','기존 회사 설명의 읽기 검수 필요','긴 문장과 추상적인 표현을 문맥·근거와 함께 검토','핵심 사실을 보존하며 초보자가 뜻을 이해하는지 확인. AI 작성 여부를 판정하지 않음','minor','needs-semantic-review');
  return result;
}

/** Delivery and content are paired; neither becomes a financial-truth verdict. */
export function jointExplanationStatus(row,findings=row.findings??[]) {
  const fund=row.explanation?.kind==='fund';
  const contentObserved=fund?!!row.explanation:row.companyExplanation?.status==='passed';
  const contentIssue=findings.some(f=>f.rule.startsWith('business-')||f.rule==='financing-as-sales');
  const content=contentIssue?'needs-work':!contentObserved?'unassessed':'review-pending';
  const screenIssue=!!row.failure||row.errorCount>0||findings.some(f=>/^(explanation-|question-|navigation-|layout-)/.test(f.rule));
  const screenObserved=row.explanation?.navigation==='passed'&&row.explanation?.terms?.captured===true
    &&row.questionPaths?.captured===true&&row.questionPaths.paths.length>0&&row.questionPaths.paths.every(path=>path.status==='passed');
  const screen=screenIssue?'needs-work':screenObserved?'observed':'unassessed';
  return {contentKind:fund?'fund':'company',content,screen,
    overall:content==='needs-work'||screen==='needs-work'?'needs-work':content==='unassessed'||screen==='unassessed'?'unassessed':'review-pending',
    semanticReview:'pending',userUnderstanding:'unmeasured',completed:false};
}

/** A bounded public reader, restoring the disclosure after reading its chapters. */
export async function captureCompanyExplanation(dialog) {
  const overview=dialog.locator('[data-company-overview]').first();if(!await overview.count())return null;
  const raw={captured:true,status:'inconclusive',coverage:await overview.getAttribute('data-company-coverage'),sources:[]};
  const summary=overview.locator('[data-explanation-summary]').first();
  if(!await summary.count())return raw;
  const detail=overview.locator('details').filter({has:overview.getByText('고객과 수익 구조 자세히 보기',{exact:true})}).first();
  let opened=false;
  try {
    await overview.getByText('사업 소개를 확인하고 있어요.',{exact:true}).waitFor({state:'hidden'});
    raw.coverage=await overview.getAttribute('data-company-coverage');
    if(await detail.count()&&!await detail.evaluate(el=>el.open)) {await detail.locator(':scope > summary').click();opened=true;}
    raw.summary=await summary.innerText();
    for(const [field,title] of [['customers','누가, 왜 쓰나요?'],['revenue','어떻게 돈을 버나요?'],['watch','다음 실적에서 볼 것']]) {
      const chapter=overview.locator('section').filter({has:overview.getByRole('heading',{name:title,exact:true})}).first().locator('p').first();
      raw[field]=await chapter.count()?await chapter.innerText():'';
    }
    const sources=overview.locator('section[aria-label="사업 설명의 근거"] a[href]');
    for(let i=0;i<Math.min(8,await sources.count());i++)raw.sources.push({label:await sources.nth(i).innerText(),url:await sources.nth(i).getAttribute('href')});
    raw.status='passed';
  } catch {raw.status='inconclusive';}
  finally {if(opened)await detail.locator(':scope > summary').click().catch(()=>{raw.status='inconclusive';});}
  return raw;
}
