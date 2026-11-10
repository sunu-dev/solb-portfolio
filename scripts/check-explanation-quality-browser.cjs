const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.MARKET_CAUSE_ORIGIN||'https://joobi.kr';
const out=path.resolve('artifacts/market-explanation-quality-20261031/browser',origin.includes('localhost')?'local':'production');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 const more=page.getByRole('button',{name:'시장 소식과 이후 변화 더 보기',exact:true});await more.waitFor({timeout:60000});await more.click();
 const watch=page.locator('[data-market-watch]').filter({has:page.getByRole('button',{name:'시장 소식 다시 불러오기',exact:true})});
 const card=watch.locator('[data-company-explanation]').first();await card.waitFor({timeout:45000});
 const disclosure=card.locator('summary');await disclosure.click();
 assert.match(await card.innerText(),/무슨 뜻인가요/);assert.match(await card.innerText(),/다음에 볼 것/);
 assert.ok(await card.locator('dl').first().isVisible());assert.match(await card.locator('a').first().getAttribute('href'),/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
 await card.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(out,`explanation-${width}.png`)});
 await disclosure.focus();const was=await card.getAttribute('open');await page.keyboard.press('Enter');assert.notEqual(await card.getAttribute('open'),was);
 if(await card.getAttribute('open')===null)await disclosure.click();
 await page.getByRole('button',{name:'다크 모드로 전환',exact:true}).click();await card.scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`explanation-dark-${width}.png`)});
 await watch.getByRole('button',{name:'한국',exact:true}).click();
 assert.equal(await watch.locator('[data-company-explanation]').count(),0);
 await watch.getByRole('button',{name:'미국',exact:true}).click();
 assert.ok(await watch.locator('[data-company-explanation]').count()>=2);
 assert.deepEqual(errors,[]);checks.push(...['company-facts-and-path','source-link','keyboard','dark-layout','market-filter','no-overflow','no-pageerror'].map(x=>x+'-'+width));await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),origin,checks},null,2));console.log(JSON.stringify({origin,checks}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
