const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.COMPANY_TRUST_ORIGIN||'http://localhost:3035';
const out=path.resolve('artifacts/company-business-completion-20261101/browser',origin==='https://joobi.kr'?'production-navigation':'local-navigation');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:960}});let release;const gate=new Promise(r=>{release=r;});let delayed=false;
 await page.route('**/api/stock-daily-brief?*',async route=>{const response=await route.fetch();delayed=true;await gate;await route.fulfill({response});});
 await page.goto(`${origin}/?stock=NFLX`,{waitUntil:'domcontentloaded'});
 const dialog=page.getByRole('dialog');const nav=dialog.getByRole('button',{name:'회사 이해',exact:true});await nav.waitFor({timeout:90000});await page.evaluate(()=>document.fonts.ready);await nav.click();
 const offset=()=>page.evaluate(()=>{const el=document.querySelector('#anchor-company'),root=el.closest('.analysis-body');return el.getBoundingClientRect().top-root.getBoundingClientRect().top;});
 await page.waitForFunction(()=>{const el=document.querySelector('#anchor-company'),root=el?.closest('.analysis-body');return el&&root&&Math.abs(el.getBoundingClientRect().top-root.getBoundingClientRect().top-16)<3;},null,{timeout:6000});
 const before=await offset();release();await dialog.getByText('최근 거래일 브리핑을 확인하고 있어요…',{exact:true}).waitFor({state:'hidden',timeout:20000});
 await page.waitForFunction(()=>{const el=document.querySelector('#anchor-company'),root=el.closest('.analysis-body');return Math.abs(el.getBoundingClientRect().top-root.getBoundingClientRect().top-16)<3;},null,{timeout:6000});
 // Exercise the same ResizeObserver path with a larger, deterministic late layout change.
 await page.evaluate(()=>{const el=document.createElement('div');el.id='navigation-layout-test';el.style.height='420px';document.querySelector('#anchor-news').prepend(el);});
 await page.waitForFunction(()=>{const el=document.querySelector('#anchor-company'),root=el.closest('.analysis-body');return Math.abs(el.getBoundingClientRect().top-root.getBoundingClientRect().top-16)<3;},null,{timeout:6000});
 await page.screenshot({path:path.join(out,`late-content-${width}.png`)});assert.ok(delayed);assert.ok(Math.abs(await offset()-before)<3);
 await dialog.locator('.analysis-body').hover();await page.mouse.wheel(0,480);
 await page.waitForFunction(()=>{const el=document.querySelector('#anchor-company'),root=el.closest('.analysis-body');return el.getBoundingClientRect().top-root.getBoundingClientRect().top < -150;},null,{timeout:6000});
 await page.evaluate(()=>{document.querySelector('#navigation-layout-test').style.height='700px';});
 await page.waitForTimeout(350);assert.ok(await offset() < -100,'manual reading must not snap back');
 checks.push({width,lateBriefing:true,largeLayoutChange:true,manualScrollReleased:true});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({origin,checks},null,2));console.log(JSON.stringify({origin,checks}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
