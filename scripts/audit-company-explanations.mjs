import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(import.meta.url),cache=new Map();
// Load the real pure classification functions; do not duplicate their routing rules in the audit.
function load(file){
 if(cache.has(file))return cache.get(file);
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=specifier=>{if(!specifier.startsWith('.')&&!specifier.startsWith('@/'))return require(specifier);let target=specifier.startsWith('@/')?path.join(root,'src',specifier.slice(2)):path.resolve(path.dirname(file),specifier);if(!path.extname(target))target+='.ts';return load(target);};
 new Function('require','exports',code)(local,exports);return exports;
}
const {companyStory}=load(path.join(root,'src/lib/companyStories.ts'));
const {explorationCompany}=load(path.join(root,'src/lib/contextExploration.ts'));
const {getStoredIndustry}=load(path.join(root,'src/lib/storedIndustry.ts'));
const {getStockIdentityKey}=load(path.join(root,'src/utils/stockCurrency.ts'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/stock-catalog.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'src/data/industry-registry.json'),'utf8'));
const rows=catalog.stocks.map(stock=>{
 const p=getStoredIndustry(stock.symbol);
 const eligible=!['etp','shell','instrument'].includes(p.status);
 const level=companyStory(stock.symbol)?'detailed':explorationCompany(stock.symbol)?.business?'reviewed-summary':p.products?'products-only':'missing';
 return {symbol:stock.symbol,name:stock.description,market:/\.(KS|KQ)$/.test(stock.symbol)?'KR':'US',eligible,industryId:p.industryId||null,classification:p.status,level};
});
const levels=list=>list.reduce((a,r)=>(a[r.level]=(a[r.level]||0)+1,a),{});
const companies=rows.filter(r=>r.eligible);
const industries=registry.industries.map(g=>{const members=companies.filter(r=>r.industryId===g.id);const examples=g.examples.map(e=>({symbol:e.symbol,level:companyStory(e.symbol)?'detailed':explorationCompany(e.symbol)?.business?'reviewed-summary':e.products?'products-only':'missing'}));return {id:g.id,name:g.name,market:g.market,parent:g.parent,total:members.length,levels:levels(members),examples};});
const result={checkedAt:new Date().toISOString(),total:companies.length,levels:levels(companies),byMarket:{US:levels(companies.filter(r=>r.market==='US')),KR:levels(companies.filter(r=>r.market==='KR'))},industryCount:industries.length,industriesWithDetailed:industries.filter(g=>g.levels.detailed).length,industriesWithReviewedBusiness:industries.filter(g=>g.levels.detailed||g.levels['reviewed-summary']).length,examplesMissing:industries.reduce((n,g)=>n+g.examples.filter(e=>e.level==='missing').length,0),examplesTotal:industries.reduce((n,g)=>n+g.examples.length,0),industries,rows};
const out=path.join(root,'artifacts/company-coverage-20261011');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(result,null,2));
// Inventory every supported corporate security; priority only affects processing order, never inclusion.
const surfaced=new Set(registry.industries.flatMap(group=>group.examples.map(example=>getStockIdentityKey(example.symbol))));
const requiredFields=['summary','customers','revenue','watch','sources'];
const inventory=companies.map(row=>{
 const profile=getStoredIndustry(row.symbol),story=companyStory(row.symbol),reviewed=explorationCompany(row.symbol);
 const missingFields=requiredFields.filter(field=>!story?.[field]||(Array.isArray(story[field])&&!story[field].length));
 const baseReady=missingFields.length===0;
 const identityNeedsReview=['not-covered','conflict'].includes(profile.status);
 const isSurfaced=surfaced.has(getStockIdentityKey(row.symbol));
 const nextStage=identityNeedsReview?'verify-identity':baseReady?'review-freshness':reviewed?'expand-business-facts':row.level==='products-only'?'collect-business-facts':'collect-business-source';
 return {symbol:row.symbol,name:row.name,market:row.market,identityKey:getStockIdentityKey(row.symbol),verifiedIssuerSymbol:profile.issuerSymbol??null,
  // No inferred ticker-to-issuer aliases; unresolved issuer identity remains explicit.
  issuerIdentityStatus:profile.issuerSymbol?'provider-verified':'requires-stable-issuer-id',industryId:row.industryId,
  currentLevel:row.level,baseReady,missingBaseFields:missingFields,isSurfaced,nextStage,priority:baseReady?3:isSurfaced?0:identityNeedsReview?1:2,
  sourceCandidates:[...(story?.sources??[]),...(reviewed?.source?[reviewed.source]:[])].map(source=>({url:source.url,label:source.label,reviewedAt:source.reviewedAt??null})),
  providerEvidence:profile.source?{provider:profile.source,checkedAt:profile.checkedAt}:null};
}).sort((a,b)=>a.priority-b.priority||a.market.localeCompare(b.market)||a.symbol.localeCompare(b.symbol));
if(inventory.length!==companies.length||new Set(inventory.map(row=>row.identityKey)).size!==inventory.length)throw Error('Company inventory lost or duplicated supported symbols');
const inventorySummary={checkedAt:result.checkedAt,total:inventory.length,businessSummaryAvailable:companies.filter(row=>['detailed','reviewed-summary'].includes(row.level)).length,
 baseReady:inventory.filter(row=>row.baseReady).length,baseIncomplete:inventory.filter(row=>!row.baseReady).length,requiredFields,
 stages:inventory.reduce((counts,row)=>(counts[row.nextStage]=(counts[row.nextStage]??0)+1,counts),{}),
 note:'Planning inventory only: nextStage is pending work, not a completed fetch, verified issuer mapping, or deployed publishing pipeline'};
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify({...inventorySummary,rows:inventory},null,2));
const summary=Object.fromEntries(Object.entries(result).filter(([key])=>!['rows','industries'].includes(key)));console.log(JSON.stringify(summary,null,2));
console.log(JSON.stringify({inventory:inventorySummary},null,2));
// This readiness check deliberately stays red until every surfaced example has an actual business explanation.
if(process.argv.includes('--check')) {
 const unresolved=industries.flatMap(g=>g.examples.filter(e=>!['detailed','reviewed-summary'].includes(e.level)).map(e=>({industry:g.id,...e})));
 if(unresolved.length) {console.error(`Company explanation readiness failed: ${unresolved.length}/${result.examplesTotal} surfaced examples lack a reviewed business explanation`);process.exitCode=1;}
}
// Full-universe gate uses the five-field contract, independently of surfaced examples.
if(process.argv.includes('--check-base')&&inventorySummary.baseIncomplete) {
 console.error(`Basic company explanation readiness failed: ${inventorySummary.baseIncomplete}/${inventorySummary.total} supported corporate symbols lack the required business fields`);
 process.exitCode=1;
}
