import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { normalizeReview, buildRun, validSymbol } from './engine.mjs';
import { DATA, init, saveRun, storeImage, writeJson } from './store.mjs';
import { reconcileImprovements } from './improvement.mjs';
import { captureQuestionPaths } from './question-paths.mjs';
import { captureTermHelp } from './term-help.mjs';
import { captureCompanyExplanation } from './company-explanation.mjs';

const TARGETS=new Set(['https://joobi.kr',...(process.env.JOOBI_LAB_TARGETS||'').split(',').filter(Boolean)]);
export function validateTarget(raw) {
  const url=new URL(raw);
  if(!TARGETS.has(url.origin)||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw Error('target_not_allowed');
  return url.origin;
}
export async function playwright() {
  if(process.env.JOOBI_LAB_PLAYWRIGHT) return import(pathToFileURL(path.join(process.env.JOOBI_LAB_PLAYWRIGHT,'index.mjs')).href);
  return import('playwright');
}
/** Reads public DOM text only, including a real disclosure open/return attempt. */
export async function captureExplanation(dialog) {
  const overview=dialog.locator('[data-explanation-overview]').first();
  if(!await overview.count())return {captured:true,kind:'unknown',navigation:'missing'};
  const summary=overview.locator('[data-explanation-summary]').first();
  const entry=overview.locator('[data-explanation-entry]').first();
  const daily=overview.locator('[data-explanation-daily]').first();
  const raw={captured:true,kind:await overview.getAttribute('data-explanation-overview'),
    coverage:await overview.getAttribute('data-explanation-coverage'),
    multiple:Number(await overview.getAttribute('data-explanation-multiple')),
    summary:await summary.count()?await summary.innerText():'',
    daily:await daily.count()?await daily.innerText():'',navigation:'missing'};
  raw.terms=await captureTermHelp(overview);
  if(!await entry.count())return raw;
  const trigger=entry.locator(':scope > summary');
  raw.entryLabel=await trigger.innerText();
  try {
    if(!await entry.evaluate(el=>el.open))await trigger.click();
    const content=entry.locator('[data-exploration-content]');await content.waitFor({state:'visible'});
    raw.scope=await content.locator('[data-explanation-scope]').innerText();
    const loading=content.getByRole('status');
    if(await loading.count())await loading.waitFor({state:'hidden'});
    const meaningful=(await content.innerText()).trim().length>raw.scope.trim().length+15;
    await trigger.click();await content.waitFor({state:'hidden'});
    raw.navigation=meaningful?'passed':'inconclusive';
  } catch(e) {raw.navigation='inconclusive';}
  return raw;
}
export async function capture({target='https://joobi.kr',selection,headless=true,viewport={width:1440,height:1000},onProgress=()=>{},signal}) {
  target=validateTarget(target);
  if(!Array.isArray(selection)||selection.length<1||selection.length>30||selection.some(x=>!validSymbol(x.symbol))||new Set(selection.map(x=>x.symbol)).size!==selection.length) throw Error('invalid_selection');
  await init();
  // Cross-process lock: a second worker cannot double the load on production.
  const lock=await fs.open(path.join(DATA,'capture.lock'),'wx').catch(e=>{if(e.code==='EEXIST')throw Error('capture_already_running');throw e;});
  await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  let browser;
  const cancel=()=>{void browser?.close().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    signal?.throwIfAborted();
    const {chromium}=await playwright();
    browser=await chromium.launch({channel:'chrome',headless});
    const rows=[],captureDir=path.join(DATA,'captures',randomUUID());
    await fs.mkdir(captureDir,{recursive:true});
    for(let i=0;i<selection.length;i++) {
      signal?.throwIfAborted();
      const item=selection[i];
      onProgress({completed:i,total:selection.length,symbol:item.symbol});
      // Each case has a new anonymous context; no user's cookies, storage or vault.
      const context=await browser.newContext({viewport,locale:'ko-KR',reducedMotion:'reduce'});
      const page=await context.newPage();page.setDefaultTimeout(12000);
      const raw={...item,checkedAt:new Date().toISOString(),sections:{},screenshots:[],network:[],pageErrors:[]};
      const pending=[];
      page.on('pageerror',e=>raw.pageErrors.push(e.message));
      page.on('response',response=>{
        const url=new URL(response.url());
        if(url.origin!==target||url.searchParams.get('symbol')!==item.symbol||!['/api/company-profile','/api/news','/api/stock-daily-brief'].includes(url.pathname))return;
        pending.push((async()=>{try{raw.network.push({url:response.url(),status:response.status(),body:await response.json()});}catch{}})());
      });
      try {
        await page.goto(`${target}/?view=news&stock=${encodeURIComponent(item.symbol)}`,{waitUntil:'domcontentloaded',timeout:30000});
        const dialog=page.getByRole('dialog');
        await dialog.getByRole('button',{name:/^(회사 이해|종목 이해)$/}).waitFor({timeout:30000});
        const fund=await dialog.locator('[data-fund-exploration]').count()>0;
        await dialog.getByText('최근 거래일 브리핑을 확인하고 있어요…',{exact:true}).waitFor({state:'hidden',timeout:12000}).catch(()=>{});
        for(const [name,selector] of [['회사 이해',fund?'[data-fund-exploration]':'[data-company-overview]'],['거래일 브리핑','[data-return-brief]'],['배우기',fund?'#anchor-learning':'[data-stock-learning]:not([data-learning-embedded])']]) {
          await dialog.getByRole('button',{name:fund&&name==='회사 이해'?'종목 이해':name,exact:true}).click();
          const section=dialog.locator(selector).first();await section.waitFor();
          await section.scrollIntoViewIfNeeded();
          raw.sections[name]=await section.innerText();
          const file=path.join(captureDir,`${item.symbol}-${raw.screenshots.length}.png`);
          await page.screenshot({path:file});raw.screenshots.push(file);
          if(name==='회사 이해') {
            raw.explanation=await captureExplanation(dialog);
            if(!fund)raw.companyExplanation=await captureCompanyExplanation(dialog);
          }
        }
        raw.overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1);
        const learning=dialog.locator(fund?'#anchor-learning':'[data-stock-learning]:not([data-learning-embedded])');
        const suggestion=learning.locator('[data-learning-suggestion]').first();
        if(await suggestion.count())raw.learningSuggestion={kind:await suggestion.getAttribute('data-learning-suggestion'),title:await suggestion.locator('strong').innerText()};
        const entry=learning.locator(fund?'button[data-reading-return]':'[data-lesson-id]').first();
        if(await entry.count()) {
          try {
            await entry.click();const answerNode=learning.locator(fund?'[data-fund-exploration]':'[data-open-lesson]');await answerNode.waitFor();
            const answer=await answerNode.innerText();
            await learning.getByRole('button',{name:fund?'← 상품 질문 목록으로 돌아가기':/^← (?:질문|개념) 목록으로$/}).click();
            await learning.locator(fund?'button[data-reading-return]':'[data-learning-resume], [data-lesson-id]').first().waitFor();
            raw.navigation={status:'passed',answerText:answer.slice(0,12000)};
          } catch(e) { raw.navigation={status:'inconclusive',reason:String(e.message).slice(0,500)}; }
        } else raw.navigation={status:'not-available'};
        raw.questionPaths=await captureQuestionPaths(fund?dialog.locator('#anchor-company [data-fund-exploration]').first():learning,{fund});
      } catch(e) {raw.failure=String(e.message).slice(0,500);}
      signal?.throwIfAborted();
      await Promise.allSettled(pending);
      const row=normalizeReview(raw);row.screenshots=[];
      for(const image of raw.screenshots)row.screenshots.push(await storeImage(image,captureDir));
      rows.push(row);
      await context.close();
      // Retain normalized observations only; raw network bodies are never stored.
      await writeJson(path.join(captureDir,item.symbol+'.json'),row);
    }
    signal?.throwIfAborted();
    const run=await saveRun(buildRun(rows,{label:'운영 화면 재검사',source:'capture',captureVersion:'0.6.0',target,viewport}));
    await reconcileImprovements(run);
    onProgress({completed:selection.length,total:selection.length,runId:run.id});
    return run;
  } finally {
    signal?.removeEventListener('abort',cancel);
    await browser?.close();await lock.close();await fs.unlink(path.join(DATA,'capture.lock')).catch(()=>{});
  }
}
