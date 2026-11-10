/** Read-only official SEC acquisition. No production DB, model call, or user records. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const req=n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n);
 new Function('require','module','exports',compiled.outputText)(req,m,m.exports);return m.exports;}
async function main(){
 const userAgent=process.env.SEC_USER_AGENT;
 if(!userAgent)throw new Error('SEC_USER_AGENT must identify Joobi and its public contact; no invented contact.');
 const {collectSecEvidence}=load(path.join(root,'src/lib/marketCause/sources/collectSec.ts'));
 const {evaluatePublication}=load(path.join(root,'src/lib/marketCause/publicationPolicy.ts'));
 const acquired=await collectSecEvidence({cik:'0000050863',userAgent,concepts:['RevenueFromContractWithCustomerExcludingAssessedTax','PaymentsToAcquirePropertyPlantAndEquipment']});
 const asOf=new Date().toISOString(),windowStart=new Date(Date.now()-7*86400000).toISOString();
 // Only the most recent fiscal end; do not call comparative prior-year facts current results.
 const latest=acquired.facts.map(f=>f.periodEnd).sort().at(-1);
 const facts=acquired.facts.filter(f=>f.periodEnd===latest).slice(0,100);
 const docIds=new Set(facts.map(f=>f.documentId));const documents=acquired.documents.filter(d=>docIds.has(d.id));
 const decision=evaluatePublication({context:{asOf,windowStart,entityIds:['CIK0000050863']},documents,facts,
  candidates:facts.slice(0,20).map((f,i)=>({id:`fact-${i}`,kind:'fact',factId:f.id}))});
 const dir=path.join(root,'artifacts/market-cause-automation-20261031');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'sec-readonly.json'),JSON.stringify({checkedAt:asOf,productionChanged:false,source:'SEC companyconcept + submissions',
  limitations:['No historical performance evaluation','Facts and general mechanisms only; price attribution not implemented'],failures:acquired.failures,rejected:acquired.rejected,documents,facts,decision},null,2));
 console.log(JSON.stringify({documents:documents.length,facts:facts.length,failures:acquired.failures,disposition:decision.disposition,claims:decision.claims.length}));
 if(!facts.length||acquired.failures.length)process.exitCode=2;
}
module.exports={load};
if(require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
