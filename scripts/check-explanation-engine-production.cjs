const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const target=process.argv[2];if(!/^https:\/\/(?:solb-portfolio-[a-z0-9]+-sunudevelop-1252s-projects\.vercel\.app|joobi\.kr)$/.test(target))throw Error('Invalid deployment');
const cwd='/private/tmp/joobi-explanation-engine-release-20261031',checks=[];
function get(route){const raw=execFileSync('npx',['--offline','--yes','vercel@65.7.0','curl',route,'--deployment',target,'--','--silent','--show-error','--max-time','45','--write-out','\n%{http_code}'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4000000,timeout:60000});const cut=raw.lastIndexOf('\n');return {status:Number(raw.slice(cut+1)),data:JSON.parse(raw.slice(0,cut))};}
function check(name,pass){checks.push({name,passed:!!pass});if(!pass)throw Error(name+' failed');}
try{
 for(const route of ['/api/cron/market-cause-shadow?symbol=INTC','/api/cron/market-cause-recovery','/api/cron/market-cause-observe'])check('unauthenticated '+route,get(route).status===401);
 const r=get('/api/market-watch');check('public API',r.status===200);
 const cards=r.data.briefs.flatMap(b=>b.companyExplanations??[]);
 check('source-backed company explanations',cards.length>=2&&cards.every(c=>c.kind==='financial_comparison'&&c.path&&c.meaning&&c.next&&c.sources.every(s=>s.url.startsWith('https://www.sec.gov/')||s.url.startsWith('https://data.sec.gov/'))));
 check('unapproved narrative/audit stays private',!JSON.stringify(r.data).match(/hypotheses|counterResolutions|provenanceHash|shadow_supported/));
 check('official policy preserved',r.data.officialPolicies?.cards.length===2);
 check('Korean and US market separation',r.data.briefs.filter(b=>b.market==='kr').every(b=>!b.companyExplanations.length));
 const result={checkedAt:new Date().toISOString(),target,checks,cards,coverage:r.data.runs};
 fs.writeFileSync('artifacts/market-explanation-engine-20261031/'+(target==='https://joobi.kr'?'production-api':'candidate-api')+'.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({target,checks,cards:cards.length}));
}catch(e){console.error(e.message);process.exitCode=1;}
