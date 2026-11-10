/** Official acquisition and deterministic explanation proof. No model or DB writes. */
const fs=require('node:fs'),path=require('node:path');
const {load}=require('./check-market-cause-sec.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/market-explanation-engine-20261031');
const {collectSecEvidence}=load(path.join(root,'src/lib/marketCause/sources/collectSec.ts'));
const {COMPANY_REGISTRY}=load(path.join(root,'src/lib/marketCause/companyRegistry.ts'));
const {explainCompanyFacts}=load(path.join(root,'src/lib/marketCause/companyFacts.ts'));
async function main(){
 fs.mkdirSync(out,{recursive:true});const rows=[];
 for(const symbol of process.argv.slice(2).length?process.argv.slice(2):['INTC','AMZN','MSFT','GOOGL']){
  if(!COMPANY_REGISTRY[symbol])throw new Error('Unknown company');
  const e=await collectSecEvidence({cik:COMPANY_REGISTRY[symbol].cik,userAgent:'Joobi/1.0 sunu.develop@gmail.com',concepts:['RevenueFromContractWithCustomerExcludingAssessedTax','NetCashProvidedByUsedInOperatingActivities','NetIncomeLoss','PaymentsToAcquirePropertyPlantAndEquipment']});
  const now=new Date().toISOString();
  const snapshot={context:{asOf:now,windowStart:new Date(Date.now()-7*86400000).toISOString(),entityIds:['CIK'+COMPANY_REGISTRY[symbol].cik]},documents:e.documents,facts:e.facts,
   decision:{disposition:'facts_only',claims:[],rejected:[],reasonCodes:[],inputHash:'',policyVersion:'source-proof'}};
  const cards=e.failures.length?[]:explainCompanyFacts(symbol,snapshot,now);
  fs.writeFileSync(path.join(out,`official-${symbol}.json`),JSON.stringify({symbol,checkedAt:now,snapshot,cards,failures:e.failures},null,2));
  const row={symbol,facts:e.facts.length,cards:cards.map(c=>({title:c.title,comparison:c.comparison})),failures:e.failures};rows.push(row);console.log(JSON.stringify(row));
 }
 fs.writeFileSync(path.join(out,'official-collection.json'),JSON.stringify(rows,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
