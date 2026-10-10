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
const {classifiedSectors}=load(path.join(root,'src/lib/sectorExploration.ts'));
const {getStoredIndustry}=load(path.join(root,'src/lib/storedIndustry.ts'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/stock-catalog.json'),'utf8'));
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'src/data/industry-catalog.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'src/data/industry-registry.json'),'utf8'));
const rows=catalog.stocks.map(stock=>{
 const profile=getStoredIndustry(stock.symbol);const result=classifiedSectors(stock.symbol,{classification:profile});
 return {symbol:stock.symbol,name:stock.description,market:/\.(KS|KQ)$/.test(stock.symbol)?'KR':'US',status:result.basis==='reviewed'?'reviewed':result.basis==='catalog'?'classified':profile.status,industryId:profile.industryId??null,sectors:result.sectors.map(s=>s.id),assetType:snapshot.assetTypes[stock.symbol]??'unconfirmed'};
});
const counts=list=>list.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
const supported=rows.filter(r=>['reviewed','classified'].includes(r.status));
const denominator=rows.filter(r=>!['etp','shell','instrument'].includes(r.status));
const report={checkedAt:snapshot.checkedAt,catalogUpdatedAt:catalog.updatedAt,total:rows.length,statuses:counts(rows),byMarket:{KR:counts(rows.filter(r=>r.market==='KR')),US:counts(rows.filter(r=>r.market==='US'))},classifiedCompanies:supported.length,companyCandidates:denominator.length,companyCoveragePercent:+(supported.length/denominator.length*100).toFixed(2),sourceIndustries:registry.industries.length,sourceIssues:snapshot.issues,unknownAssetTypes:rows.filter(r=>r.assetType==='unconfirmed').length,limits:['검색 목록은 주식·우선주·펀드·상장상품을 포함합니다.','펀드형 상품·스팩·발행사 미연결 증권은 기업 업종 분류율의 분모에서 분리했습니다.','자료가 없거나 공급자 간 충돌한 종목은 미해결이며 100% 완료로 간주하지 않습니다.','세부 업종 자료의 출처별 분류 체계는 공식 통합 분류 표준과 같지 않습니다.'],rows};
const output=process.argv[2]||'artifacts/industry-coverage-20261011';fs.mkdirSync(path.join(root,output),{recursive:true});fs.writeFileSync(path.join(root,output,'coverage.json'),JSON.stringify(report,null,2));
const {rows:_,...summary}=report;console.log(JSON.stringify(summary,null,2));
