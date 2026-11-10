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
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261101_company_business_engine.sql'),'utf8');
  const expected=[...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*? AS \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],hash:crypto.createHash('md5').update(m[2]).digest('hex')}));
  if(expected.length!==6)throw new Error('Expected six functions');
  const actual=await query(`select p.proname as name,md5(p.prosrc) as hash,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${expected.map(r=>literal(r.name)).join(',')})`,true);
  if(actual.length!==6||expected.some(e=>!actual.some(a=>a.name===e.name&&a.hash===e.hash&&!a.anon&&!a.authenticated&&a.service)))throw new Error('Production function or permissions mismatch');
  const tables=await query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') as anon,has_table_privilege('authenticated',c.oid,'SELECT') as authenticated from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='company_business_private' and c.relkind='r'",true);
  if(tables.length!==4||tables.some(t=>!t.relrowsecurity||t.anon||t.authenticated))throw new Error('Production table isolation mismatch');
  const result={checkedAt:new Date().toISOString(),functions:actual,tables};fs.writeFileSync(path.join(out,'production-schema-verified.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({functions:actual.length,privateTables:tables.length,matched:true}));return;
 }
 if(action==='apply'){await query(fs.readFileSync(path.join(root,'supabase/migrations/20261101_company_business_engine.sql'),'utf8'),true);}
 else if(action==='seed'){const rows=lib('inventory').businessInventory();let inserted=0;for(let at=0;at<rows.length;at+=500){const r=await query(`select public.seed_company_business(${json(rows.slice(at,at+500))}) as n`,true);inserted+=r[0].n;}console.log(JSON.stringify({inserted,total:rows.length}));}
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
