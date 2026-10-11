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
const {classifiedSectors,SECTORS,sectorsForCompany}=load(path.join(root,'src/lib/sectorExploration.ts'));
const {explorationCompany}=load(path.join(root,'src/lib/contextExploration.ts'));
const {getStoredIndustry}=load(path.join(root,'src/lib/storedIndustry.ts'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/stock-catalog.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'src/data/industry-registry.json'),'utf8'));
const rows=catalog.stocks.map(stock=>{
 const profile=getStoredIndustry(stock.symbol);const classification=classifiedSectors(stock.symbol,{classification:profile});
 const business=explorationCompany(stock.symbol);
 return {symbol:stock.symbol,name:stock.description,sourceStatus:profile.status,industryId:profile.industryId??null,basis:classification.basis,businessSectors:sectorsForCompany(stock.symbol).filter(s=>s.parent).map(s=>({id:s.id,name:s.name})),businessName:business?.name??null,businessSource:business?.source??null};
});
const groups=registry.industries.map(group=>{
 const members=rows.filter(row=>row.industryId===group.id);const areas=[...new Set(members.flatMap(row=>row.businessSectors.map(s=>s.id)))];
 const reviewed=members.filter(row=>row.businessSectors.length);
 // One company with several businesses alone is not evidence of different companies being mixed.
 const mixed=reviewed.some((row,index)=>reviewed.slice(index+1).some(other=>!row.businessSectors.some(area=>other.businessSectors.some(candidate=>candidate.id===area.id))));
 return {id:group.id,name:group.name,parent:group.parent,market:group.market,catalogMembers:members.length,reviewedBusinessMembers:reviewed.length,knownBusinessAreas:areas,mixedKnownBusinesses:mixed};
});
const candidates=rows.filter(r=>!['etp','shell','instrument'].includes(r.sourceStatus));
const summary={checkedAt:new Date().toISOString(),sourceIndustries:groups.length,majorIndustries:SECTORS.filter(s=>!s.parent).length,businessSubsectors:SECTORS.filter(s=>s.parent).length,total:candidates.length,withBusinessSubsector:candidates.filter(r=>r.businessSectors.length).length,withoutBusinessSubsector:candidates.filter(r=>!r.businessSectors.length).length,knownMixedSourceGroups:groups.filter(g=>g.mixedKnownBusinesses).length};
const out=path.join(root,'artifacts/sector-recheck-20261011');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({...summary,sectors:SECTORS.map(s=>({id:s.id,name:s.name,parent:s.parent,anchor:s.anchor,companies:s.companies})),groups,rows},null,2));console.log(JSON.stringify(summary,null,2));
