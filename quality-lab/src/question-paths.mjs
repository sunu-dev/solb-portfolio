import {captureTermHelp,normalizeTermHelp} from './term-help.mjs';
const clip=(x,n=8000)=>typeof x==='string'?x.slice(0,n):'';
export function normalizeQuestionPaths(raw) {
  if(!raw || raw.captured!==true)return null;
  return {captured:true,policy:'question-paths-v1',semanticReview:'pending',userUnderstanding:'unmeasured',
    paths:(Array.isArray(raw.paths)?raw.paths:[]).slice(0,16).map(p=>({
      titles:(Array.isArray(p.titles)?p.titles:[]).slice(0,3).map(x=>clip(x,300)),
      answer:clip(p.answer),next:(Array.isArray(p.next)?p.next:[]).slice(0,3).map(x=>clip(x,300)),
      status:['passed','failed','inconclusive'].includes(p.status)?p.status:'inconclusive',
      terms:normalizeTermHelp(p.terms),
    }))};
}
export function questionPathFindings(row) {
  const paths=row.questionPaths?.paths;if(!paths)return [];
  const findings=[];
  const add=(rule,title,proposal,acceptance)=>findings.push({rule,title,proposal,acceptance,severity:'major',confidence:'needs-semantic-review'});
  if(!paths.length||paths.some(p=>p.status!=='passed'||p.answer.trim().length<20))
    add('question-path-incomplete','질문·답변 탐색 미확인','숨긴 질문과 다음 답변까지 실제 클릭 후 기록','첫 질문·다른 질문·이어지는 답변과 복귀를 확인');
  const answers=new Map();
  for(const p of paths) {
    const key=p.answer.replace(/\s+/g,' ').trim();
    const title=p.titles.at(-1);
    if(key && answers.has(key)&&answers.get(key)!==title) {
      add('question-answer-repeated','서로 다른 질문에 같은 답변 반복','질문의 차이에 맞는 실제 답을 제공','문구만 바꾸지 않고 질문에 필요한 정보를 설명');break;
    }
    if(key)answers.set(key,title);
  }
  if(paths.some(p=>p.next.some(t=>p.titles.slice(0,-1).includes(t))))
    add('question-path-backtrack','다음 질문이 방금 읽은 설명으로 되돌아감','아직 읽지 않은 관련 설명을 우선 연결','같은 설명 순환을 강요하지 않으며 이전 설명은 별도로 접근');
  if(paths.some(p=>/맥락을 탐색|인사이트를 도출|다각도로 조망|여정을 시작|한층 더 깊이/.test(p.answer)))
    add('question-language-review','추상적인 표현 검토 필요','일상적인 말과 실제 확인 대상·행동으로 표현','문맥을 읽고 편집 검수. AI 작성 여부를 판정하는 검사가 아님');
  if(paths.some(p=>p.terms?.expected.some(id=>!p.terms.linked.includes(id))))
    add('question-term-help-missing','답변 속 어려운 용어 설명 누락','질문 답변 안에서도 뜻 설명을 제공','원문을 떠나 검색하지 않고 뜻을 확인하고 돌아올 수 있어야 함');
  if(paths.some(p=>p.terms?.probes.some(probe=>probe.status!=='passed')))
    add('question-term-dialog-unverified','답변 속 용어 창 열기·읽기·복귀 미확인','실패한 용어 창을 같은 답변에서 다시 확인','본문 링크 존재만으로 통과시키지 않고 뜻을 읽고 원문으로 복귀');
  return findings;
}

/** Bounded public reader traversal. Does not open AI generation, orders or accounts. */
export async function captureQuestionPaths(root,{fund=false,maxBranches=7}={}) {
  const paths=[];
  const titleOf=async(button)=>{
    const strong=button.locator('strong');
    return (await (await strong.count()?strong.first():button).innerText()).trim().replace(/\s*→$/,'');
  };
  const reset=async()=>{
    const back=root.getByRole('button',{name:fund?'상품 구조로':/^← (?:질문|개념) 목록으로$/,exact:true});
    if(await back.count())await back.first().click();
    const more=root.locator(fund?'[data-fund-more]':'details').last();
    if(await more.count()&&!await more.evaluate(el=>el.open))await more.locator(':scope > summary').click();
  };
  const entrySelector=fund?'[data-fund-question]':'[data-lesson-id]';
  const answerSelector=fund?'[data-fund-answer]':'[data-open-lesson]';
  const nextSelector=fund?'[data-fund-question]:visible':'[data-learning-related]:visible';
  const read=async(titles)=>{
    const answer=root.locator(answerSelector).first();await answer.waitFor({state:'visible'});
    const next=root.locator(nextSelector),names=[];
    for(let i=0;i<Math.min(2,await next.count());i++)names.push(await titleOf(next.nth(i)));
    let text=await answer.innerText();
    const example=root.locator('[data-daily-example]');
    if(fund&&await example.count())text+='\n'+await example.innerText();
    paths.push({titles,answer:text,next:names,status:'passed',terms:await captureTermHelp(root,{limit:1})});
    return next;
  };
  await reset();
  const buttons=root.locator(entrySelector),ids=[];
  for(let i=0;i<await buttons.count();i++) {
    const id=await buttons.nth(i).getAttribute(fund?'data-fund-question':'data-lesson-id');
    if(id&&/^[a-z0-9-]+$/.test(id)&&!ids.includes(id))ids.push(id);
  }
  for(const id of ids.slice(0,Math.min(7,maxBranches))) {
    let title=id;
    try {
      await reset();const button=root.locator(`[${fund?'data-fund-question':'data-lesson-id'}="${id}"]`).first();
      title=await titleOf(button);await button.click();
      const next=await read([title]);
      if(await next.count()) {
        const child=next.first(),childTitle=await titleOf(child);
        await child.click();await read([title,childTitle]);
      }
    } catch {paths.push({titles:[title],answer:'',next:[],status:'inconclusive'});}
  }
  try {await reset();} catch {paths.push({titles:['질문 목록 복귀'],answer:'',next:[],status:'inconclusive'});}
  return {captured:true,paths};
}
