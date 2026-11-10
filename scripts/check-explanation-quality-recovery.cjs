/** One live, budgeted recovery after the existing cooldown. No retry bypass. */
const fs=require('node:fs'),{parseEnv}=require('node:util'),path=require('node:path');
const out=path.resolve('artifacts/market-explanation-quality-20261031');
const env=parseEnv(fs.readFileSync('/private/tmp/joobi-explanation-quality-release-20261031/.env.production.local','utf8'));
(async()=>{
 const prior=JSON.parse(fs.readFileSync(path.join(out,'live-INTC.json')));
 const retryAt=Date.parse(prior.checkedAt)+15*60000+10000;
 console.log(JSON.stringify({retryAfter:new Date(retryAt).toISOString()}));
 while(Date.now()<retryAt)await new Promise(resolve=>setTimeout(resolve,Math.min(30000,retryAt-Date.now())));
 const startedAt=new Date().toISOString();
 const r=await fetch('https://joobi.kr/api/cron/market-cause-recovery?group=chips',{headers:{Authorization:'Bearer '+env.CRON_SECRET},signal:AbortSignal.timeout(300000)});
 const data=await r.json();fs.writeFileSync(path.join(out,'production-recovery.json'),JSON.stringify({startedAt,checkedAt:new Date().toISOString(),status:r.status,data},null,2));
 console.log(JSON.stringify({status:r.status,data}));if(!r.ok)process.exitCode=1;
})().catch(e=>{console.error(e.name);process.exitCode=1;});
