/** One bounded, budget-reserved diagnostic. Never prints keys or provider error bodies. */
const fs=require('fs'),path=require('path'),{randomUUID}=require('crypto');
const {load}=require('./check-market-cause-sec.cjs');
const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!url?.includes('ytowigkzunbrhyucbsqu'))throw Error('Project mismatch');
 const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
 const budget={reserve:async(key,max)=>{const {data,error}=await db.rpc('reserve_market_cause_budget',{p_request_key:key,p_max_cost:max});if(error)throw Error('budget unavailable');return data;},
 settle:async(key,token,cost)=>{const {data,error}=await db.rpc('settle_market_cause_budget',{p_request_key:key,p_token:token,p_actual_cost:cost});return !error&&data===true;}};
 const {createNarrativeModel}=load(path.resolve('src/lib/marketCause/narrativeModel.ts'));
 let result;
 try{await createNarrativeModel(process.env.GEMINI_API_KEY,budget).generate('diagnostic:'+randomUUID()+':draft','No public evidence is provided. Return {"hypotheses":[]}.');result={status:'responded'};}
 catch(e){result={status:'held',reason:/^narrative_[a-z_]+$/.test(e.message)?e.message:'diagnostic_failed'};}
 const out={checkedAt:new Date().toISOString(),oneAttempt:true,...result};
 fs.writeFileSync('artifacts/market-cause-automation-20261031/provider-health.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
})().catch(()=>{console.error('Diagnostic unavailable; raw details omitted');process.exitCode=1;});
