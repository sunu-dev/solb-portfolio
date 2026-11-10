const fs=require('node:fs'), path=require('node:path'), net=require('node:net'), assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root=path.resolve(__dirname,'..'),stage='/private/tmp/joobi-market-flow-engine-20261031';
const out=path.join(root,'artifacts/market-flow-engine-20261031');
const routePath=path.join(stage,'src/app/flow-check');
const feed=JSON.parse(fs.readFileSync(path.join(out,'public-feed.json'),'utf8'));
feed.briefs=JSON.parse(fs.readFileSync(path.join(out,'live-replay.json'),'utf8')).briefs;
(async()=>{
 assert.ok(!fs.existsSync(routePath));fs.mkdirSync(routePath);
 fs.writeFileSync(path.join(routePath,'page.tsx'),`'use client';\nimport MarketWatch from '@/components/market/MarketWatch';\nexport default function Page(){return <main style={{maxWidth:860,margin:'auto',padding:20}}><MarketWatch /></main>;}\n`);
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const origin='http://localhost:'+port,log=fs.openSync(path.join(out,'ui-next.log'),'w');
 const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{
 cwd:stage,stdio:['ignore',log,log],env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://synthetic-flow.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key'}});
 let browser;
 try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(origin+'/flow-check',{signal:AbortSignal.timeout(10000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(ready);browser=await chromium.launch({channel:'chrome',headless:true});const checks=[];
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}});const requests=[],errors=[];let reply=feed;
   await context.route('**/*',route=>{const u=new URL(route.request().url());
    if(u.origin===origin&&u.pathname==='/api/market-watch'){requests.push({method:route.request().method(),body:route.request().postData(),query:u.search});return route.fulfill({contentType:'application/json',body:JSON.stringify(reply)});}
    if(u.origin===origin)return route.continue();return route.fulfill({body:'',contentType:'text/javascript'});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/flow-check');
   await page.getByRole('heading',{name:'나스닥이 S&P 500보다 더 크게 내렸어요',exact:true}).waitFor();
   assert.equal(await page.locator('[data-market-flow-brief]').count(),2);
   await page.getByText(/11개 중 5개 하락, 6개 상승/).first().waitFor();
   await page.getByRole('button',{name:'미국',exact:true}).click();assert.equal(await page.locator('[data-market-flow-brief]').count(),1);
   await page.getByText('인텔은 지난 실적보다 다음 분기 전망을 봐야 해요',{exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const links=await page.locator('[data-market-flow-brief] a').evaluateAll(a=>a.map(e=>({url:e.href,rel:e.rel,target:e.target})));
   assert.ok(links.every(a=>a.url.startsWith('https:')&&a.rel.includes('noopener')&&a.target==='_blank'));
   const disclosure=page.getByText('왜 움직였고, 무엇을 이어서 볼까요?',{exact:true});await disclosure.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('[data-market-flow-brief] > details').getAttribute('open'),null);await page.keyboard.press('Enter');
   await page.screenshot({path:path.join(out,`flow-${width}.png`),fullPage:false});
   reply={...feed,briefs:[]};await page.getByRole('button',{name:'시장 소식 다시 불러오기'}).click();
   await page.getByText(/같은 거래일의 주요 지수 자료가 충분하지 않아/).waitFor();
   assert.ok(requests.every(r=>r.method==='GET'&&r.body===null&&r.query===''));
   assert.deepEqual(errors,[]);checks.push(`automatic-brief-${width}`,`market-filter-${width}`,`source-links-${width}`,`keyboard-disclosure-${width}`,`no-horizontal-overflow-${width}`,`no-holdings-request-${width}`,`insufficient-data-${width}`);
   await context.close();
  }
  fs.writeFileSync(path.join(out,'ui-result.json'),JSON.stringify({checks,productionChanged:false,scope:'Actual Next MarketWatch component with public captured feed; no investment data or authenticated session'},null,2)+'\n');console.log(checks.length+' browser checks passed');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');fs.closeSync(log);fs.rmSync(routePath,{recursive:true,force:true});fs.rmSync(path.join(stage,'.next/dev/types'),{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
