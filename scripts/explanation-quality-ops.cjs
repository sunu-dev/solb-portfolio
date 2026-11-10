/** Pinned, reviewable operations. No credentials, user rows or model calls. */
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./check-market-cause-sec.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/market-explanation-quality-20261031');
const project='ytowigkzunbrhyucbsqu',action=process.argv[2]??'status';
if(!['apply','verify','status','seed-facts','inspect'].includes(action))throw new Error('Unknown action');
let token=process.env.SUPABASE_ACCESS_TOKEN??'';
if(!token)for(const account of ['supabase','access-token'])try{token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();if(token)break;}catch{}
if(!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token))throw new Error('Existing CLI authentication unavailable');
async function query(sql,readOnly=true){const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Management HTTP '+r.status);return r.json();}
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const json=v=>literal(JSON.stringify(v))+'::jsonb';
async function main(){
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261031_market_cause_quality.sql'),'utf8');
 if(action==='apply')await query(sql,false);
 if(action==='seed-facts'){
  const {saveCompanyFacts}=load(path.join(root,'src/lib/marketCause/companyFactsCycle.ts'));
  const {explainCompanyFacts}=load(path.join(root,'src/lib/marketCause/companyFacts.ts'));
  for(const symbol of process.argv.slice(3)){
   if(!/^(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL)$/.test(symbol))throw new Error('Unknown symbol');
   const source=JSON.parse(fs.readFileSync(path.join(out,`official-${symbol}.json`),'utf8'));
   if(source.failures.length||Date.now()-Date.parse(source.checkedAt)>3600000)throw new Error('Source must be complete and observed in last hour');
   const snapshot=source.snapshot;
   if(snapshot.facts.length&&!explainCompanyFacts(symbol,snapshot,new Date().toISOString()).length)throw new Error('No verified comparison for nonempty source');
   const port={read:async event=>{const rows=await query(`select h.revision,v.payload->'snapshot' as snapshot from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id where h.event_key=${literal(event)}`);return rows[0]??null;},
    claim:async(key,event,hash,owner)=>(await query(`select public.claim_market_cause_job(${literal(key)},${literal(event)},${literal(hash)},${literal(owner)}) as result`,false))[0].result,
    publish:async i=>(await query(`select public.publish_market_cause_shadow(${literal(i.key)},${literal(i.hash)},${literal(i.owner)},${i.fence},${i.expectedRevision},${json({disposition:i.snapshot.decision.disposition,claims:i.snapshot.decision.claims,snapshot:i.snapshot})}) as result`,false))[0].result.status};
   const result=await saveCompanyFacts({symbol,owner:crypto.randomUUID(),context:snapshot.context,documents:snapshot.documents,facts:snapshot.facts,port});
   console.log(JSON.stringify({symbol,result}));if(!['stored','finished'].includes(result))throw new Error('Seed did not store');
  }
 }
 if(action==='inspect'){
  const symbol=process.argv[3];if(!/^(INTC|NVDA|AMD|AMZN|GOOGL|MSFT|META|AAPL)$/.test(symbol))throw Error('A fixed company is required');
  const snapshots=await query(`select h.event_key,h.revision,v.id,v.created_at,v.payload->'snapshot' as snapshot from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id where h.event_key in (${['facts:'+symbol,'sec:'+symbol,'draft:sec:'+symbol,'collection:'+symbol+':'+new Date().toISOString().slice(0,10)].map(literal).join(',')})`);
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`inspection-${symbol}.json`),JSON.stringify({checkedAt:new Date().toISOString(),snapshots},null,2));
 }
 if(action==='verify'){
  const names=['read_market_cause_quality_inputs','record_market_cause_quality','market_cause_recovery_queue','market_cause_recovery_due'];
  const rows=await query("select p.proname,p.prosrc,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ("+names.map(literal).join(',')+")");
  for(const name of names){const r=rows.find(r=>r.proname===name);const start=sql.indexOf('FUNCTION public.'+name+'(');const body=sql.slice(start).split('AS $$')[1].split('$$;')[0].trim();if(!r||r.prosrc.trim()!==body||r.anon||r.authenticated||!r.service)throw Error('Installed quality function/grants differ: '+name);}
 }
 const rows=await query("select (select jsonb_build_object('facts',company_facts,'narratives',narrative_release is not null) from market_cause_private.publication_control where id=true) as publication,(select json_agg(q) from (select day,policy,checked_at,report from market_cause_private.quality_runs order by day desc limit 2) q) as quality,(select json_agg(q) from (select policy,split,review_status,development_exposed,count(*) from market_cause_private.evaluation_queue group by 1,2,3,4) q) as evaluation,(select sum(pg_total_relation_size(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='market_cause_private' and c.relkind='r') as private_storage_bytes,(select json_agg(x) from (select h.event_key,h.revision,v.created_at,jsonb_array_length(v.payload->'snapshot'->'facts') as facts from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id where h.event_key like 'facts:%' order by h.event_key) x) as heads,(select json_agg(x) from (select period_kind,period_start,calls,spent,reserved from market_cause_private.budget_periods order by period_start desc limit 4) x) as budget");
 const result={action,checkedAt:new Date().toISOString(),project,migrationHash:crypto.createHash('sha256').update(sql).digest('hex'),...rows[0]};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`production-${action}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
