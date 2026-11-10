/** Small, explicitly bounded live-provider check using public SEC documents.
 * Atomic budget in a disposable, network-isolated PostgreSQL; no production writes.
 */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {load}=require('./check-market-cause-sec.cjs');const root=path.resolve(__dirname,'..');
const dir=path.join(root,'artifacts/market-cause-automation-20261031');fs.mkdirSync(dir,{recursive:true});
const target=process.argv[2]||'INTC';
const companies={INTC:'0000050863',AMZN:'0001018724',MSFT:'0000789019',GOOGL:'0001652044'};
if(!companies[target])throw new Error('Unsupported live-test target');
const counterexample=process.argv.includes('--counterexample');
const artifact=original=>{const name=counterexample?original.replace(/\.json$/,'-counterexample.json'):original;return path.join(dir,target==='INTC'?name:name.replace(/\.json$/, '-'+target+'.json'));};
const name='joobi-narrative-live-'+randomUUID().slice(0,8);
const shell=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4000000});
const sql=s=>shell(['exec','-i',name,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],s).trim();
const quote=v=>"'"+String(v).replace(/'/g,"''")+"'";
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 if(!process.env.GEMINI_API_KEY)throw new Error('Existing GEMINI_API_KEY required');
 const {collectSecNarratives}=load(path.join(root,'src/lib/marketCause/sources/secNarrative.ts'));
 const {makeNarrativePacket}=load(path.join(root,'src/lib/marketCause/narrativeReview.ts'));
 const {createNarrativeModel,NARRATIVE_TARIFF,NARRATIVE_REVIEW_TARIFF}=load(path.join(root,'src/lib/marketCause/narrativeModel.ts'));
 const {runNarrative}=load(path.join(root,'src/lib/marketCause/runNarrative.ts'));
 const {renderNarrativePreview}=load(path.join(root,'src/lib/marketCause/renderNarrative.ts'));
 const docs=await collectSecNarratives({cik:companies[target],symbol:target,userAgent:'Joobi/1.0 sunu.develop@gmail.com'});
 if(!docs.length)throw new Error('No recent SEC narrative documents; no model calls made');
 const now=new Date().toISOString();const context={asOf:now,windowStart:new Date(Date.now()-7*86400000).toISOString(),entityIds:['CIK'+companies[target]]};
 const packet=makeNarrativePacket(docs,context);
 fs.writeFileSync(artifact('narrative-sources.json'),JSON.stringify({checkedAt:now,documents:docs,packet},null,2));
 console.log('Official SEC narratives:',docs.length,'selected paragraphs:',Object.keys(packet.passages).length);
 shell(['run','--detach','--rm','--name',name,'--network','none','--memory','512m','--cpus','1.5','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 try{
  let ready=false;
  for(let i=0;i<100;i++){try{const log=execFileSync('docker',['logs',name],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
    if(log.includes('init process complete; ready for start up')){sql('select 1;');ready=true;break;}}catch{}await delay(200);}
  if(!ready)throw new Error('isolated database not ready');
  sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role;');
  sql(fs.readFileSync(path.join(root,'supabase/proposals/market_cause_budget_v1.sql'),'utf8'));
  sql('UPDATE market_cause_private.budget_control SET enabled=true,daily_limit=50000,monthly_limit=50000,daily_calls=2;');
  const budget={reserve:async(key,max)=>JSON.parse(sql(`SET ROLE service_role;select public.reserve_market_cause_budget(${quote(key)},${max});`)),
   settle:async(key,token,actual)=>sql(`SET ROLE service_role;select public.settle_market_cause_budget(${quote(key)},${quote(token)},${actual});`)==='t'};
  const raw=[];const provider=createNarrativeModel(process.env.GEMINI_API_KEY,budget);
  const model={generate:async(key,prompt,binding)=>{const response=counterexample&&key.endsWith(':draft')?{hypotheses:[{id:'h1',entityId:'CIK'+companies[target],summary:'CPU 수요가 사라져 관련 제품 생산을 모두 중단했다고 회사가 밝혔어요.',pathway:'demand_supply',support:['p0'],counterEvidence:[]}]}:await provider.generate(key,prompt,binding);raw.push({stage:key.endsWith(':draft')?'draft':'review',response});return response;}};
  const result=await runNarrative({documents:docs,context,model,attemptKey:'live-'+randomUUID()});
  fs.writeFileSync(artifact('narrative-untrusted-model-output.json'),JSON.stringify({warning:'Untrusted model output, not verified or publicly published',raw},null,2));

  const ledger=JSON.parse(sql("select json_build_object('calls',count(*),'reservedMicrousd',coalesce(sum(max_cost) filter(where state='reserved'),0),'meteredEstimateMicrousd',coalesce(sum(actual_cost),0)) from market_cause_private.budget_reservations;"));
  fs.writeFileSync(artifact('narrative-live-result.json'),JSON.stringify({checkedAt:now,productionChanged:false,tariff:{draft:NARRATIVE_TARIFF,review:NARRATIVE_REVIEW_TARIFF},ledger,
   scope:counterexample?'Synthetic false claim against real source, actual provider review. Not historical accuracy evaluation.':'One company, one actual generation/review. Not historical accuracy evaluation.',result,preview:result.assessment?renderNarrativePreview(result.assessment,packet):null},null,2));
  fs.appendFileSync(path.join(dir,'narrative-live-runs.jsonl'),JSON.stringify({checkedAt:now,target,counterexample,policyVersion:packet.version,models:[NARRATIVE_TARIFF.model,NARRATIVE_REVIEW_TARIFF.model],status:result.status,errorCode:result.errorCode,ledger})+'\n');
  console.log(JSON.stringify({status:result.status,error:result.errorCode,assessment:result.assessment?.status,ledger}));
  if(result.status!=='reviewed'||counterexample&&result.assessment?.hypotheses.length)process.exitCode=2;
 }finally{try{shell(['rm','-f',name]);}catch{}}
})().catch(e=>{console.error(/^[A-Za-z0-9 _:;.,-]{1,180}$/.test(e.message)?e.message:'Live check failed; details intentionally omitted');process.exitCode=1;});
