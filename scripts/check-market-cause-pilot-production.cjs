const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync}=require('node:fs');
const {parseEnv}=require('node:util');
const deployment=process.argv[2];const mode=process.argv[3]??'disabled';
if(!/^https:\/\/(?:solb-portfolio-[a-z0-9]+-sunudevelop-1252s-projects\.vercel\.app|joobi\.kr)$/.test(deployment)||!['disabled','run','public','sweep','existing'].includes(mode))throw Error('Invalid bounded check target');
const symbol=process.argv[4]??'INTC';
if(!['INTC','GOOGL','AMZN','MSFT'].includes(symbol))throw Error('Unsupported targeted live check');
const cwd='/private/tmp/joobi-market-cause-pilot-release-20261031';
const env=parseEnv(readFileSync(cwd+'/.env.production.local','utf8'));if(!env.CRON_SECRET)throw Error('Production cron configuration unavailable');
function get(path,auth=false){
 const args=['--offline','--yes','vercel@65.7.0','curl',path,'--deployment',deployment,'--','--silent','--show-error','--max-time','230','--write-out','\n%{http_code}'];
 if(auth)args.push('--header','Authorization: Bearer '+env.CRON_SECRET);
 const output=execFileSync('npx',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4_000_000,timeout:240000});
 const position=output.lastIndexOf('\n');const status=Number(output.slice(position+1));const body=output.slice(0,position);
 let data;try{data=JSON.parse(body);}catch{data=undefined;}
 return {status,data};
}
const checks=[];
function expect(name,response,status,valid=()=>true){if(response.status!==status||!valid(response.data))throw Error(name+' failed, HTTP '+response.status);
 checks.push({name,status:response.status,...(name.startsWith('private')?{result:response.data}:{})});}
expect('anonymous cron rejected',get('/api/cron/market-cause-shadow?symbol=INTC'),401);
if(mode==='disabled')expect('private worker disabled',get('/api/cron/market-cause-shadow?symbol='+symbol,true),200,d=>d.status==='disabled'&&d.publicEligible===false);
if(mode==='existing')expect('private completed request remains deduplicated',get('/api/cron/market-cause-shadow?symbol='+symbol,true),200,d=>d.status==='finished'&&d.publicEligible===false);
if(mode==='run'){
 expect('private actual source model persistence',get('/api/cron/market-cause-shadow?symbol='+symbol,true),200,d=>d.status==='stored'&&d.publicEligible===false&&d.collection?.status==='stored');
 expect('private duplicate skips all collection',get('/api/cron/market-cause-shadow?symbol='+symbol,true),200,d=>d.status==='finished'&&d.publicEligible===false);
}
if(mode==='sweep')for(const symbol of ['NVDA','AMD','AMZN','GOOGL','MSFT','META','AAPL']){
 const response=get('/api/cron/market-cause-shadow?symbol='+symbol,true);
 checks.push({name:'private '+symbol,status:response.status,result:response.data});
 console.log(symbol,response.status,response.data?.status,response.data?.collection?.status);
}
expect('public market feed',get('/api/market-watch'),200,d=>d&&!JSON.stringify(d).includes('shadow_supported'));
expect('public configuration',get('/api/config'),200);
expect('home',get('/'),200);
const output={checkedAt:new Date().toISOString(),deployment,mode,symbol,checks};
writeFileSync(`artifacts/market-cause-automation-20261031/production-${mode}-${symbol}-check.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
