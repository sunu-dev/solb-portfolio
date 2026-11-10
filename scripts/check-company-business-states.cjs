// Browser-only fixtures. Never stores, approves or publishes a real company explanation.
const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.COMPANY_TRUST_ORIGIN||'http://localhost:3034';
if(!origin.startsWith('http://localhost:'))throw new Error('Fixtures are restricted to the isolated local app');
const out=path.resolve('artifacts/company-business-engine-20261101/browser/fixtures');fs.mkdirSync(out,{recursive:true});
const business={symbol:'NFLX',level:'detailed',origin:'engine',version:'fixture',validUntil:'2099-01-01T00:00:00Z',sourcePublishedAt:'2026-01-01',
 summary:'자동 테스트 전용 설명이에요. 실제 넷플릭스의 사업 설명이나 검수 결과가 아니에요.',
 customers:'테스트용 고객 설명이에요. 화면에 고객 항목이 빠짐없이 연결되는지 확인하는 자료예요.',
 revenue:'테스트용 수익 구조 설명이에요. 원문의 매출 근거를 검증한 실제 기업 자료가 아니에요.',
 watch:'테스트용 점검 관점이에요. 회사의 실적이나 주가 등락 원인을 나타내는 설명이 아니에요.',
 sources:[{label:'자동 테스트 고정 자료 · 실제 기업 근거 아님',url:'https://example.com/business-test',reviewedAt:'2026-11-01'}]};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
try{for(const width of [390,1440])for(const state of ['published','withheld','http-error','timeout']){
 const page=await browser.newPage({viewport:{width,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>{release=r;});
 await page.route('**/api/company-profile?*',async route=>{
  if(state==='timeout')await gate;
  if(state==='http-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'test_unavailable'})});
  const value=state==='withheld'?{symbol:'NFLX',level:'missing',origin:'engine',sources:[],availability:'rechecking'}:business;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{business:value}})}).catch(error=>{if(state!=='timeout')throw error;});
 });
 await page.goto(`${origin}/?stock=NFLX`,{waitUntil:'domcontentloaded'});
 const overview=page.locator('[data-company-overview]');await overview.waitFor({timeout:60000});
 if(state==='timeout'){
  assert.match(await overview.innerText(),/사업 소개를불러오지못했어요|사업 소개를 확인하고 있어요|사업 소개를 불러오지 못했어요/);
  assert.doesNotMatch(await overview.innerText(),/회원 구독료|영상 콘텐츠를/);release();
 }
 const expected=state==='withheld'?'사업 소개의 근거를 다시 확인하고 있어요.':['http-error','timeout'].includes(state)?'사업 소개를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.':business.summary;
 await overview.getByText(expected,{exact:true}).waitFor({timeout:15000});
 if(['published'].includes(state)){
  for(const text of [business.customers,business.revenue,business.watch])assert.ok((await overview.innerText()).includes(text));
  assert.equal(await overview.getByRole('link',{name:/자동 테스트 고정 자료/}).count(),1);
  assert.equal(await overview.getByText('생활 속 예로 이해하기',{exact:true}).count(),0);
 }else{assert.equal(await overview.getByRole('region',{name:'사업 설명의 근거'}).count(),0);assert.doesNotMatch(await overview.innerText(),/회원 구독료/);}
 await overview.evaluate(el=>{const root=el.closest('.analysis-body');root.scrollTo({top:root.scrollTop+el.getBoundingClientRect().top-root.getBoundingClientRect().top-16,behavior:'instant'});});
 assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:path.join(out,`${state}-${width}.png`)});assert.deepEqual(errors,[]);checks.push({state,width});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({origin,fixturesOnly:true,checks},null,2));console.log(JSON.stringify({fixturesOnly:true,checks}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
