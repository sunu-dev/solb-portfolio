/** Read-only browser/API smoke; no login, portfolio mutations or notification calls. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const out=process.env.MARKET_FLOW_OUTPUT?path.resolve(process.env.MARKET_FLOW_OUTPUT):path.resolve(__dirname,'../artifacts/market-flow-engine-20261031');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const origin=process.env.MARKET_FLOW_ORIGIN||'https://joobi.kr';
 const response=await fetch(origin+'/api/market-watch');assert.equal(response.status,200);
 const feed=await response.json();assert.ok(feed.briefs?.length>=1);
 const us=feed.briefs.find(b=>b.market==='us');assert.ok(us);assert.equal(us.breadth.total,11);
 assert.ok(us.benchmarks.every(b=>Number.isFinite(b.change)&&b.sourceUrl.startsWith('https:')));
 const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[];
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:960}});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.locator('[data-market-flow-brief]').first().waitFor({timeout:45000});
   assert.ok(await page.locator('[data-market-flow-brief]').first().isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('[data-market-flow-brief]').first().scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,`production-${width}.png`)});
   assert.deepEqual(errors,[]);checks.push(`live-home-brief-${width}`,`no-horizontal-overflow-${width}`,`no-browser-exception-${width}`);
   await page.close();
  }
 }finally{await browser.close();}
 const result={checkedAt:new Date().toISOString(),origin,checks,briefs:feed.briefs.map(b=>({market:b.market,sessionDate:b.sessionDate,headline:b.headline,breadth:b.breadth,companies:b.companies.map(c=>({symbol:c.symbol,change:c.change})),freshness:b.freshness})),runs:feed.runs.map(r=>({scope:r.scope,checkedAt:r.checkedAt,coverage:r.coverage,warnings:r.warnings}))};
 fs.writeFileSync(path.join(out,'production-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
