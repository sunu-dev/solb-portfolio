/** Local/operational runner. Never prints environment variables or provider credentials. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/company-business-engine-20261101');fs.mkdirSync(out,{recursive:true});
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
 const m={exports:{}};cache.set(file,m);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const req=name=>{if(!name.startsWith('.')&&!name.startsWith('@/'))return require(name);let dest=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(file),name);if(!path.extname(dest))dest+='.ts';return load(dest);};
 new Function('require','module','exports',code)(req,m,m.exports);return m.exports;}
const lib=name=>load(path.join(root,'src/lib/companyBusiness',name+'.ts'));
const literal=value=>"'"+String(value).replaceAll("'","''")+"'",json=value=>literal(JSON.stringify(value))+'::jsonb';
async function query(sql,write=false){let token=process.env.SUPABASE_ACCESS_TOKEN??'';
 if(!token)for(const account of ['supabase','access-token'])try{token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-a',account,'-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();if(token)break;}catch{}
 if(!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token))throw new Error('Existing Supabase CLI authentication unavailable');
 const r=await fetch('https://api.supabase.com/v1/projects/ytowigkzunbrhyucbsqu/database/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:!write}),signal:AbortSignal.timeout(30000)});
 if(!r.ok){const error=await r.json().catch(()=>({}));throw new Error('Management HTTP '+r.status+' '+String(error.message??error.error??'').slice(0,600));}return r.json();}
async function main(){const action=process.argv[2]??'status',symbol=process.argv[3];
 if(action==='dispatch-plan'||action==='progress-plan'){
  if(!symbol)throw new Error('Repair manifest required');
  const manifest=lib('repairRequest').parseRepairManifest(JSON.parse(fs.readFileSync(symbol,'utf8')));
  const key=process.env.DART_API_KEY||process.env.OPENDART_API_KEY||'';
  let results;
  if(action==='dispatch-plan'){
   const ready=manifest.requests.filter(r=>key||lib('market').businessMarket(r.symbol)!=='KR').map(r=>r.symbol);
   const waiting=manifest.requests.filter(r=>!ready.includes(r.symbol)).map(r=>({symbol:r.symbol,status:'source-unconfigured'}));
   results=[...(ready.length?(await query(`select public.request_company_business_repairs(${literal(manifest.id)},${json(ready)}) as results`,true))[0].results:[]),...waiting];
  }else{
   results=manifest.requests.length?await query(`select j.symbol,j.state,j.reason,j.evidence_hash,j.draft_hash,j.next_attempt_at,
    (j.snapshot->'evidence'<>'null'::jsonb) as source_collected,(j.snapshot->'draft'<>'null'::jsonb) as drafted,
    (j.snapshot->'review'<>'null'::jsonb) as model_reviewed,(j.approval is not null) as editorially_approved,
    case when public.read_company_business(j.symbol)#>>'{approval,draftHash}'=j.draft_hash then j.draft_hash else null end as published_version,
    j.approval->>'approvedAt' as approved_at from company_business_private.jobs j cross join company_business_private.control c where j.symbol in (${manifest.requests.map(r=>literal(r.symbol)).join(',')})`,true):[];
  }
  const receipt={requestId:manifest.id,at:new Date().toISOString(),results};const file=path.join(out,`${action}-${manifest.id}.json`);
  fs.writeFileSync(file,JSON.stringify(receipt,null,2));console.log(JSON.stringify({file,results:results.map(r=>({symbol:r.symbol,status:r.status||r.state,reason:r.reason}))}));return;
 }
 if(action==='apply-improvements'){
  await query(fs.readFileSync(path.join(root,'supabase/migrations/20261101_company_business_improvement.sql'),'utf8'),true);
  console.log('improvement_queue_applied');return;
 }
 if(action==='audit-sources'){
  const source=lib('sources'),key=process.env.DART_API_KEY||process.env.OPENDART_API_KEY||'';
  const sec=await source.secDirectory(),dart=key?await source.dartDirectory(key):undefined;
  const resolve=load(path.join(root,'src/lib/storedIndustry.ts')).getStoredIndustry;
  const inventory=lib('inventory').businessInventory().map(r=>({...r,conflict:resolve(r.symbol).status==='conflict'}));
  const report=lib('coverage').auditBusinessMapping({inventory,sec,dart,checkedAt:new Date().toISOString()});
  fs.writeFileSync(path.join(out,'source-mapping-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,stage:report.stage,counts:report.counts,markets:report.markets}));return;
 }
 if(action==='inventory'){const rows=lib('inventory').businessInventory();fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify({total:rows.length,rows},null,2));console.log(JSON.stringify({total:rows.length,surfaced:rows.filter(r=>r.priority===0).length}));return;}
 if(action==='collect'){
  if(!/^[A-Z0-9^.=-]{1,32}$/.test(symbol??''))throw new Error('Symbol required');
  const sources=lib('sources'),key=process.env.DART_API_KEY||process.env.OPENDART_API_KEY||'';
  const evidence=lib('market').businessMarket(symbol)==='KR'?await sources.collectDartBusiness(symbol,await sources.dartDirectory(key),key):await sources.collectSecBusiness(symbol,await sources.secDirectory());
  fs.writeFileSync(path.join(out,`source-${symbol}.json`),JSON.stringify(evidence,null,2));console.log(JSON.stringify({symbol,issuer:evidence.identity.issuerId,documentId:evidence.documentId,passages:evidence.passages.length,source:evidence.url}));return;
 }
 if(action==='run'){const result=await lib('worker').runBusinessWorker(symbol);fs.writeFileSync(path.join(out,'last-worker.json'),JSON.stringify({checkedAt:new Date().toISOString(),...result},null,2));console.log(JSON.stringify(result));return;}
 if(action==='verify'){
  const migration=['20261101_company_business_engine.sql','20261101_company_business_improvement.sql'].map(f=>fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8')).join('\n');
  const expected=[...new Map([...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)].map(m=>[m[1],{name:m[1],hash:crypto.createHash('md5').update(m[2]).digest('hex')}])).values()];
  if(expected.length!==7)throw new Error('Expected seven functions');
  const actual=await query(`select p.proname as name,md5(p.prosrc) as hash,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${expected.map(r=>literal(r.name)).join(',')})`,true);
  if(actual.length!==7||expected.some(e=>!actual.some(a=>a.name===e.name&&a.hash===e.hash&&!a.anon&&!a.authenticated&&a.service)))throw new Error('Production function or permissions mismatch');
  const tables=await query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') as anon,has_table_privilege('authenticated',c.oid,'SELECT') as authenticated from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='company_business_private' and c.relkind='r'",true);
  if(tables.length!==4||tables.some(t=>!t.relrowsecurity||t.anon||t.authenticated))throw new Error('Production table isolation mismatch');
  const result={checkedAt:new Date().toISOString(),functions:actual,tables};fs.writeFileSync(path.join(out,'production-schema-verified.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({functions:actual.length,privateTables:tables.length,matched:true}));return;
 }
 if(action==='apply'){for(const f of ['20261101_company_business_engine.sql','20261101_company_business_improvement.sql'])await query(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'),true);}
 else if(action==='seed'){const rows=lib('inventory').businessInventory();let inserted=0;for(let at=0;at<rows.length;at+=500){const r=await query(`select public.seed_company_business(${json(rows.slice(at,at+500))}) as n`,true);inserted+=r[0].n;}console.log(JSON.stringify({inserted,total:rows.length}));}
 else if(action==='job-limit'){
  const count=Number(symbol);if(!Number.isInteger(count)||count<1||count>20)throw new Error('Invalid job limit');
  await query(`update company_business_private.control set daily_jobs=${count} where id=true`,true);
 }
 else if(['worker-on','worker-off','publication-on','publication-off'].includes(action)){
  const column=action.startsWith('worker')?'worker_enabled':'publication_enabled';await query(`update company_business_private.control set ${column}=${action.endsWith('-on')} where id=true`,true);
 }else if(action==='inspect'||action==='review-packet'){
  if(!/^[A-Z0-9^.=-]{1,32}$/.test(symbol??''))throw new Error('Symbol required');
  const rows=await query(`select symbol,state,reason,evidence_hash,draft_hash,snapshot,approval from company_business_private.jobs where symbol=${literal(symbol)}`);
  fs.writeFileSync(path.join(out,`review-${symbol}.json`),JSON.stringify(rows[0]??null,null,2));
  if(action==='review-packet'){
   if(!rows[0])throw new Error('Company not queued');
   const html=lib('reviewPacket').businessReviewPacket(symbol,rows[0].snapshot,rows[0].reason,new Date().toISOString());
   fs.writeFileSync(path.join(out,`review-${symbol}.html`),html);
  }
  console.log(JSON.stringify(rows.map(r=>({symbol:r.symbol,state:r.state,reason:r.reason,evidenceHash:r.evidence_hash,draftHash:r.draft_hash}))));return;
 }else if(action==='revise-editorial'){
  if(!/^[A-Z0-9^.=-]{1,32}$/.test(symbol??'')||!process.argv[4])throw new Error('Symbol and bound editorial revision required');
  const input=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
  if(input.kind!=='editorial-revision'||input.symbol!==symbol||typeof input.note!=='string'||input.note.length<20)throw new Error('Editorial revision required');
  const row=(await query(`select snapshot,evidence_hash,draft_hash from company_business_private.jobs where symbol=${literal(symbol)}`))[0];
  if(!row||row.evidence_hash!==input.evidenceHash||row.draft_hash!==input.draftHash)throw new Error('Review version changed');
  const v=lib('validation'),now=new Date().toISOString(),draft=v.validateDraft(input.draft,row.snapshot.evidence,now).draft;
  if(!draft)throw new Error('Editorial draft rejected');
  const draftHash=v.hash(draft),snapshot={...row.snapshot,draft,review:null,repair:{attempts:row.snapshot.repair?.attempts??0,feedback:null}};
  const saved=await query(`update company_business_private.jobs set snapshot=${json(snapshot)},draft_hash=${literal(draftHash)},approval=null,state='review_pending',reason='editorial_revision_review',next_attempt_at=clock_timestamp()+interval '30 minutes',updated_at=clock_timestamp() where symbol=${literal(symbol)} and state in ('approval_pending','blocked') and evidence_hash=${literal(input.evidenceHash)} and draft_hash=${literal(input.draftHash)} and lease_until is null returning symbol`,true);
  if(saved.length!==1)throw new Error('Editorial revision stale');
  const budget=load(path.join(root,'src/lib/marketCause/supabaseBudgetPort.ts')).createMarketCauseBudgetPort();
  const raw=await lib('model').createBusinessModel(process.env.GEMINI_API_KEY??'',budget).review(`business:editorial:${symbol}:${draftHash}`,snapshot.evidence,draft);
  const review=v.validateReview(raw,draft,snapshot.evidence).review;
  snapshot.review=review;if(!review)snapshot.repair.feedback=v.reviewFeedback(raw,draft,snapshot.evidence);
  const state=review?'approval_pending':'blocked',reason=review?'editorial_revision_reviewed':'editorial_revision_rejected';
  const result=await query(`with changed as (update company_business_private.jobs set snapshot=${json(snapshot)},state=${literal(state)},reason=${literal(reason)},next_attempt_at=clock_timestamp()+interval '1 day',updated_at=clock_timestamp() where symbol=${literal(symbol)} and draft_hash=${literal(draftHash)} and evidence_hash=${literal(input.evidenceHash)} and state='review_pending' and lease_until is null returning *) insert into company_business_private.audit(symbol,fence,action,evidence_hash,draft_hash) select symbol,fence,${literal(reason)},evidence_hash,draft_hash from changed returning symbol`,true);
  if(result.length!==1)throw new Error('Editorial review stale');console.log(JSON.stringify({symbol,state,draftHash}));return;
 }else if(action==='reject-editorial'){
  if(!/^[A-Z0-9^.=-]{1,32}$/.test(symbol??'')||!process.argv[4])throw new Error('Symbol and editorial rejection file required');
  const input=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
  if(input.kind!=='editorial-rejection'||input.symbol!==symbol||typeof input.note!=='string'||input.note.length<20)throw new Error('Editorial rejection required');
  const row=(await query(`select snapshot,evidence_hash,draft_hash from company_business_private.jobs where symbol=${literal(symbol)}`))[0];
  if(!row||row.evidence_hash!==input.evidenceHash||row.draft_hash!==input.draftHash)throw new Error('Review version changed');
  // Old v1 rows used order-sensitive JSON hashes. Bind the explicit rejection
  // to the stored hashes above, then normalize only its negative feedback.
  const v=lib('validation'),bound={...input.feedback,policy:lib('types').BUSINESS_POLICY,draftHash:v.hash(row.snapshot.draft),evidenceHash:v.evidenceHash(row.snapshot.evidence)};
  const feedback=v.reviewFeedback(bound,row.snapshot.draft,row.snapshot.evidence);
  if(!feedback||v.validateReview(feedback,row.snapshot.draft,row.snapshot.evidence).review)throw new Error('Bound rejection details required');
  const snapshot={...row.snapshot,review:null,repair:{attempts:row.snapshot.repair?.attempts??0,feedback}};
  const results=await query(`with changed as (update company_business_private.jobs set snapshot=${json(snapshot)},approval=null,state='blocked',reason='editorial_rejected',next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() where symbol=${literal(symbol)} and state='approval_pending' and evidence_hash=${literal(input.evidenceHash)} and draft_hash=${literal(input.draftHash)} and lease_until is null returning *) insert into company_business_private.audit(symbol,fence,action,evidence_hash,draft_hash) select symbol,fence,'editorial_rejected',evidence_hash,draft_hash from changed returning symbol`,true);
  if(results.length!==1)throw new Error('Editorial rejection not stored');console.log('editorial_rejection_recorded');return;
 }else if(action==='approve'){
  if(!/^[A-Z0-9^.=-]{1,32}$/.test(symbol??'')||!process.argv[4])throw new Error('Symbol and explicit editorial review file required');
  const approval=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
  if(approval.symbol!==symbol||approval.kind!=='editorial'||!approval.evidenceHash||!approval.draftHash)throw new Error('Bound editorial review required');
  const row=(await query(`select snapshot,evidence_hash,draft_hash from company_business_private.jobs where symbol=${literal(symbol)}`))[0];
  if(!row||row.evidence_hash!==approval.evidenceHash||row.draft_hash!==approval.draftHash)throw new Error('Review version changed');
  const v=lib('validation');v.publicProjection(row.snapshot.evidence,row.snapshot.draft,row.snapshot.review,new Date().toISOString());
  const result=(await query(`select public.approve_company_business(${literal(symbol)},${literal(approval.evidenceHash)},${literal(approval.draftHash)},${json(approval)}) as approved`,true))[0];
  if(!result.approved)throw new Error('Approval not stored');
 }else if(action!=='status')throw new Error('Unknown action');
 const result={checkedAt:new Date().toISOString(),action,...(await query('select public.company_business_status() as status',true))[0].status};
 fs.writeFileSync(path.join(out,`production-${action}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
module.exports={load};if(require.main===module)main().catch(error=>{const message=error instanceof Error?error.message:'operation_failed';console.error(/https?:|key=|token=/i.test(message)?'operation_failed':message);process.exitCode=1});
