/** Pinned, reviewable operations. No credentials, user rows or model calls. */
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./check-market-cause-sec.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/market-explanation-engine-20261031');
const project='ytowigkzunbrhyucbsqu',action=process.argv[2]??'status';
if(!['apply','verify','status','facts-on','facts-off','release-narratives','narratives-off','seed-facts'].includes(action))throw new Error('Unknown action');
let token=process.env.SUPABASE_ACCESS_TOKEN??'';
if(!token)for(const account of ['supabase','access-token'])try{token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();if(token)break;}catch{}
if(!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token))throw new Error('Existing CLI authentication unavailable');
async function query(sql,readOnly=true){const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Management HTTP '+r.status);return r.json();}
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const json=v=>literal(JSON.stringify(v))+'::jsonb';
async function main(){
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261031_market_cause_company_publication.sql'),'utf8');
 if(action==='apply')await query(sql,false);
 if(action==='facts-on'||action==='facts-off')await query(`UPDATE market_cause_private.publication_control SET company_facts=${action==='facts-on'} WHERE id=true`,false);
 if(action==='narratives-off')await query('UPDATE market_cause_private.publication_control SET narrative_release=null WHERE id=true',false);
 if(action==='release-narratives'){
  if(!process.argv[3])throw new Error('A real independently reviewed evaluation manifest is required');
  const data=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  const {createNarrativeRelease}=load(path.join(root,'src/lib/marketCause/narrativeRelease.ts'));
  const release=createNarrativeRelease(data.rows,data.observations,new Date().toISOString());
  await query(`UPDATE market_cause_private.publication_control SET narrative_release=${json(release)} WHERE id=true`,false);
 }
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
 if(action==='verify'){
  const expected=sql.match(/AS \$\$([^]*?)\$\$;/)[1].trim();
  const rows=await query("select p.prosrc,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='read_market_cause_companies'");
  if(rows.length!==1||rows[0].prosrc.trim()!==expected||rows[0].anon||rows[0].authenticated||!rows[0].service)throw new Error('Installed function/grants differ');
 }
 const rows=await query("select (select jsonb_build_object('facts',company_facts,'narratives',narrative_release is not null) from market_cause_private.publication_control where id=true) as publication,(select json_agg(x) from (select h.event_key,h.revision,v.created_at,jsonb_array_length(v.payload->'snapshot'->'facts') as facts from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id where h.event_key like 'facts:%' order by h.event_key) x) as heads,(select json_agg(x) from (select period_kind,period_start,calls,spent,reserved from market_cause_private.budget_periods order by period_start desc limit 4) x) as budget");
 const result={action,checkedAt:new Date().toISOString(),project,migrationHash:crypto.createHash('sha256').update(sql).digest('hex'),...rows[0]};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`production-${action}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
