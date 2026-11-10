/** Narrow operations for the private market-evidence pilot. Never reads user records. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ref='ytowigkzunbrhyucbsqu';
const action=process.argv[2]??'inspect';
if(!['inspect','apply','status','enable','disable'].includes(action))throw new Error('Unsupported operation');
let token=process.env.SUPABASE_ACCESS_TOKEN??'';
if(!token&&process.platform==='darwin')for(const account of ['supabase','access-token']){
 try{token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();if(token)break;}catch{}
}
if(!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token))throw new Error('Existing Supabase CLI authentication unavailable');
async function query(sql,readOnly=true){
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error('Management operation HTTP '+r.status);return r.json();
}
const inspectSQL=`select to_regnamespace('market_cause_private') is not null as installed,
 (select count(*) from information_schema.tables where table_schema='market_cause_private') as tables,
 (select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname in
 ('reserve_market_cause_budget','settle_market_cause_budget','claim_market_cause_job','publish_market_cause_shadow','read_market_cause_shadow','market_cause_worker_enabled')) as functions`;
const statusSQL=`select
 (select row_to_json(c) from (select enabled,daily_limit,monthly_limit,daily_calls,stopped_reason from market_cause_private.budget_control) c) as budget,
 (select enabled from market_cause_private.worker_control where id=true) as worker_enabled,
 (select json_agg(p) from (select * from market_cause_private.budget_periods order by period_start desc limit 4) p) as periods,
 (select json_agg(j) from (select case when status='running' and lease_until<clock_timestamp() then 'lease_expired' else status end as status,count(*) from market_cause_private.jobs group by 1) j) as jobs,
 (select json_agg(v) from (select h.event_key,h.revision,v.created_at,v.payload->'snapshot'->'decision'->>'disposition' as disposition,
 v.payload->'snapshot'->'decision'->'reasonCodes' as reasons,
 v.payload->'snapshot'->'narrative'->'run'->>'status' as narrative_run,
 v.payload->'snapshot'->'narrative'->'run'->'assessment'->>'status' as assessment,
 v.payload->'snapshot'->'narrative'->'run'->'assessment'->>'policyVersion' as policy,
 jsonb_array_length(COALESCE(v.payload->'snapshot'->'narrative'->'run'->'assessment'->'hypotheses','[]'::jsonb)) as explanations
 from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id order by v.created_at desc limit 32) v) as heads,
 (select sum(pg_total_relation_size(c.oid)) from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='market_cause_private' and c.relkind='r') as storage_bytes`;
const before=await query(inspectSQL);
let result,hashes;
if(action==='inspect')result=before;
else if(action==='apply'){
 if(before[0].installed||Number(before[0].functions))throw new Error('Private schema already exists; inspect before changing it');
 const files=['supabase/proposals/market_cause_budget_v1.sql','supabase/proposals/market_cause_jobs_v1.sql'];
 const contents=files.map(f=>readFileSync(f,'utf8'));
 hashes=Object.fromEntries(files.map((f,i)=>[f,createHash('sha256').update(contents[i]).digest('hex')]));
 // One outer transaction; strip only the explicit proposal transaction delimiters.
 const body=contents.map(s=>s.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'')).join('\n');
 await query('BEGIN;'+body+"\nNOTIFY pgrst, 'reload schema';COMMIT;",false);result=await query(inspectSQL);
}else{
 if(!before[0].installed)throw new Error('Private schema not installed');
 if(action==='enable'){
  if(Date.now()>=Date.parse('2026-11-14T08:00:00Z'))throw new Error('Pilot period ended');
  await query("BEGIN;UPDATE market_cause_private.budget_control SET enabled=true,daily_limit=50000,monthly_limit=1000000,daily_calls=20 WHERE id=true AND stopped_reason IS NULL;UPDATE market_cause_private.worker_control SET enabled=true WHERE id=true;COMMIT;",false);
 }
 if(action==='disable')await query('BEGIN;UPDATE market_cause_private.worker_control SET enabled=false WHERE id=true;UPDATE market_cause_private.budget_control SET enabled=false WHERE id=true;COMMIT;',false);
 result=await query(statusSQL);
}
const output={checkedAt:new Date().toISOString(),project:ref,action,hashes,result};
mkdirSync('artifacts/market-cause-automation-20261031',{recursive:true});
writeFileSync(`artifacts/market-cause-automation-20261031/production-pilot-${action}.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
