const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.COMPANY_TRUST_ORIGIN||'http://localhost:3032';
const out=path.resolve('artifacts/company-trust-20261031/browser',origin.includes('localhost')?'local':origin==='https://joobi.kr'?'production':'candidate');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [symbol,name,level] of [['NFLX','넷플릭스','detailed'],['009150.KS','삼성전기','detailed'],['ABNB',null,'missing']]){
  const responses=[];page.on('response',response=>{if(response.url().includes('/api/company-profile?'))responses.push(response.status());});
  await page.goto(`${origin}/?stock=${encodeURIComponent(symbol)}`,{waitUntil:'domcontentloaded'});
  const dialog=page.getByRole('dialog'), overview=dialog.locator('[data-company-overview]');await overview.waitFor({timeout:90000});
  await dialog.getByText('최근 거래일 브리핑을 확인하고 있어요…',{exact:true}).waitFor({state:'hidden',timeout:20000});
  await page.evaluate(()=>document.fonts.ready);
  await dialog.getByRole('button',{name:'회사 이해',exact:true}).click();
  if(name)assert.equal(await dialog.locator('[data-dialog-initial-focus]').innerText(),name);
  assert.equal(await overview.getAttribute('data-company-coverage'),level);
  assert.doesNotMatch(await overview.innerText(),/20%|10%|기대에는 못 미쳤/);
  if(level==='detailed'){
   assert.match(await overview.innerText(),/누가, 왜 쓰나요\?/);assert.match(await overview.innerText(),/어떻게 돈을 버나요\?/);
   const guide=overview.locator('[data-company-reading-guide]');assert.equal(await guide.getAttribute('open'),null);
   await page.locator('[data-company-overview]').evaluate(el=>{const root=el.closest('.analysis-body');root.scrollTo({top:root.scrollTop+el.getBoundingClientRect().top-root.getBoundingClientRect().top-16,behavior:'instant'});});
   assert.equal(await overview.locator('figure').isVisible(),false);
   await page.screenshot({path:path.join(out,`${symbol}-${width}.png`)});
   await guide.locator('summary').focus();await page.keyboard.press('Enter');assert.notEqual(await guide.getAttribute('open'),null);
   assert.match(await guide.innerText(),/이 종목의 실적 평가나 등락 이유를 뜻하지 않아요/);
   await page.keyboard.press('Enter');assert.equal(await guide.getAttribute('open'),null);
   const sources=overview.getByRole('region',{name:'사업 설명의 근거'});assert.equal(await sources.locator('a').count(),2);
   for(const link of await sources.locator('a').all())assert.match(await link.getAttribute('href'),/^https:\/\//);
   checks.push(`${symbol}-${width}:business,sources,optional-guide,keyboard,no-fake-earnings`);
  }else{
   assert.match(await overview.innerText(),/주비에 아직 준비되지 않았어요/);
   assert.equal(await overview.locator('figure,[data-company-reading-guide]').count(),0);
   checks.push(`${symbol}-${width}:honest-gap,no-filler-art`);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(responses.includes(200),`profile API must succeed: ${symbol} ${width} ${JSON.stringify(responses)}`);
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 }
 await page.getByRole('button',{name:'다크 모드로 전환',exact:true}).click();
 await page.goto(`${origin}/?stock=NFLX`,{waitUntil:'domcontentloaded'});
 const dark=page.locator('[data-company-overview]');await dark.waitFor({timeout:60000});
 await page.getByRole('dialog').getByText('최근 거래일 브리핑을 확인하고 있어요…',{exact:true}).waitFor({state:'hidden',timeout:20000});await page.getByRole('dialog').getByRole('button',{name:'회사 이해',exact:true}).click();await page.locator('[data-company-overview]').evaluate(el=>{const root=el.closest('.analysis-body');root.scrollTo({top:root.scrollTop+el.getBoundingClientRect().top-root.getBoundingClientRect().top-16,behavior:'instant'});});await page.screenshot({path:path.join(out,`NFLX-dark-${width}.png`)});
 assert.deepEqual(errors,[]);checks.push(`${width}:modal-close,layout,dark,no-pageerror`);await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),origin,checks},null,2));console.log(JSON.stringify({origin,checks}));})().catch(e=>{console.error(e.stack);process.exitCode=1;});
