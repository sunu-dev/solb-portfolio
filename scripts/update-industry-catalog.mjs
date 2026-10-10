/** Refresh validated public industry evidence (atomic replacement per file). No AI inference, account data, or DB writes. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
const root=fileURLToPath(new URL('..',import.meta.url));
const out=process.argv.includes('--output-dir') ? process.argv[process.argv.indexOf('--output-dir')+1] : join(root,'src/data');
const sourceDir=process.argv.includes('--source-dir') ? process.argv[process.argv.indexOf('--source-dir')+1] : null;
const now=new Date().toISOString();
const urls={us:'https://stockanalysis.com/_api/endpoints/screener/initial?type=stock&countryCode=&format=compact',kr:'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13'};
const parents=new Set(['technology','communication','consumer-discretionary','consumer-staples','energy','financials','healthcare','industrials','materials','real-estate','utilities']);
async function mapping(file){return new Map((await readFile(join(root,'sources/industries',file),'utf8')).split('\n').filter(x=>x&&!x.startsWith('#')).map(line=>{const [parent,raw,name]=line.split('|');if(!parents.has(parent)||!raw)throw Error('Invalid taxonomy row');return [raw,{parent,name:name||raw}]}));}
const [usMap,krMap]=await Promise.all([mapping('us-taxonomy.tsv'),mapping('kr-taxonomy.tsv')]);
async function fetchBytes(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`Source unavailable (${r.status})`);const b=new Uint8Array(await r.arrayBuffer());if(b.length>15000000)throw Error('Source too large');return b;}
const usBytes=sourceDir?await readFile(join(sourceDir,'us-source.json')):await fetchBytes(urls.us);
const us=JSON.parse(new TextDecoder().decode(usBytes)).data;
if(!us||us.rows.length<4500||us.count!==us.rows.length)throw Error('Incomplete US industry source');
const at=Object.fromEntries(us.columns.map((x,i)=>[x,i]));
for(const key of ['s','n','industry','marketCap'])if(at[key]===undefined)throw Error('US columns changed');
function decode(s){return s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();}
let kr;
if(sourceDir){kr=JSON.parse(await readFile(join(sourceDir,'krx-source.json'),'utf8')).slice(1);}
else{const html=new TextDecoder('euc-kr').decode(await fetchBytes(urls.kr));const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>decode(c[1])));if(rows[0]?.[2]!=='종목코드'||rows[0]?.[3]!=='업종')throw Error('KR columns changed');kr=rows.slice(1);}
if(kr.length<2300)throw Error('Incomplete KR industry source');
const records={},groups=new Map(),issues=[],unmapped=new Set();
const assetTypes={}, masterNames={};
const key=(market,raw)=>`${market}-${createHash('sha256').update(raw).digest('hex').slice(0,12)}`;
function add(symbol,name,raw,market,products='',cap=null){
 if(!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol))throw Error('Invalid source symbol');
 if(!raw||raw==='Other'){records[symbol]={name,status:'missing-industry',source:market};return;}
 if(raw==='Shell Companies'||/스팩|기업인수목적/.test(name)){records[symbol]={name,status:'shell',source:market};return;}
 const mapped=(market==='us'?usMap:krMap).get(raw);
 if(!mapped){unmapped.add(market+':'+raw);records[symbol]={name,status:'unmapped-industry',source:market,rawIndustry:raw};return;}
 const id=key(market,raw);
 if(records[symbol]&&records[symbol].industryId!==id){issues.push({symbol,reason:'conflicting source industry'});records[symbol]={name,status:'conflict',source:market};return;}
 records[symbol]={name,industryId:id,...(products?{products}:{}),status:'classified',source:market};
 if(!groups.has(id))groups.set(id,{id,name:mapped.name,raw,parent:mapped.parent,market,companies:new Map()});
 groups.get(id).companies.set(symbol,{symbol,name,...(products?{products}:{}),marketCap:Number.isFinite(cap)&&cap>0?cap:null});
}
for(const r of us.rows)add(String(r[at.s]).replaceAll('.','-'),r[at.n],r[at.industry], 'us','',r[at.marketCap]);
for(const r of kr){if(!['유가','코스닥'].includes(r[1]))continue;if([r[0],r[2],r[3]].some(x=>x.includes('�')))throw Error('Corrupt KR classification');add(r[2]+(r[1]==='유가'?'.KS':'.KQ'),r[0],r[3],'kr',r[4].includes('�')?'':r[4]);}
// Exact-symbol profiles fill bulk-source gaps. Never refresh their evidence date implicitly.
const supplement=JSON.parse(await readFile(join(root,'sources/industries/profile-supplement.json'),'utf8'));
for(const row of supplement.records){
 if(records[row.symbol] && records[row.symbol].status!=='missing-industry')continue;
 if(row.url!==`https://stockanalysis.com/stocks/${row.symbol.toLowerCase()}/company/`)throw Error('Invalid supplement source');
 const age=Date.parse(now)-Date.parse(row.checkedAt);
 if(!Number.isFinite(age)||age<0||age>30*86400000)continue;
 add(row.symbol,row.name,row.industry,'us');
 Object.assign(records[row.symbol],{evidenceUrl:row.url,evidenceCheckedAt:row.checkedAt,...(row.listingNote?{listingNote:row.listingNote}:{})});
}
if(unmapped.size)throw Error('Unmapped source labels: '+[...unmapped].join(', '));
// The existing KIS master tells stocks and exchange traded products apart.
const files=[['nasmst.cod','US'],['nysmst.cod','US'],['amsmst.cod','US'],['kospi_code.mst','KS'],['kosdaq_code.mst','KQ']];
for(const [file,market] of files){
 const archive=sourceDir?await readFile(join(sourceDir,file+'.zip')):await fetchBytes('https://new.real.download.dws.co.kr/common/master/'+file+'.zip');
 const entries=unzipSync(new Uint8Array(archive),{filter:e=>e.name.toLowerCase()===file&&e.originalSize<20000000});const bytes=Object.entries(entries).find(([name])=>name.toLowerCase()===file)?.[1];if(!bytes)throw Error('Missing KIS master');
 if(market==='US'){
  for(const line of new TextDecoder('euc-kr',{fatal:true}).decode(bytes).split(/\r?\n/)){const f=line.split('\t').map(x=>x.trim());if(!f[4]||f[9]!=='USD')continue;const s=f[4].replaceAll('.','-');masterNames[s]={name:f[6],englishName:f[7]};
   const label=f[6]+' '+f[7];
   if(f[8]==='3')assetTypes[s]='etp';
   else if(f[8]==='2')assetTypes[s]=/우선주|PREFERRED (?:STOCK|SHARES)|DEPOSITARY SHARES.*SERIES/i.test(label)?'preferred':/유닛|\bUNITS?\b/i.test(label)?'unit':/워런트|\bWARRANTS?\b/i.test(label)?'warrant':/채권|\b(?:SENIOR|SUBORDINATED) NOTES\b|\bBONDS?\b/i.test(label)?'debt':'stock';}
 }else{
  let start=0;for(let end=0;end<=bytes.length;end++){if(end<bytes.length&&bytes[end]!==10)continue;const line=bytes.subarray(start,end);start=end+1;if(line.length<63)continue;const decoder=new TextDecoder('euc-kr',{fatal:true});const s=decoder.decode(line.subarray(0,9)).trim()+'.'+market;const type=decoder.decode(line.subarray(61,63));masterNames[s]={name:decoder.decode(line.subarray(21,61)).trim()};if(['EF','EN'].includes(type))assetTypes[s]='etp';else if(['ST','FS','RT'].includes(type))assetTypes[s]='stock';}
 }
}
// Korean preferred shares inherit an issuer only when BOTH the official code stem and name match.
for(const [symbol,info] of Object.entries(masterNames)){
 if(!/^[0-9A-Z]{6}\.(KS|KQ)$/.test(symbol)||records[symbol]||!/[0-9]*우(?:[BC])?(?:\([^)]*\))?$/.test(info.name))continue;
 const issuer=symbol.slice(0,5)+'0'+symbol.slice(6),owner=masterNames[issuer],record=records[issuer];
 if(owner && info.name.startsWith(owner.name) && record?.status==='classified'){
  assetTypes[symbol]='preferred';records[symbol]={...record,name:info.name,securityType:'preferred',issuerSymbol:issuer};
 }
}
for(const [symbol,type] of Object.entries(assetTypes)){
 if(type==='etp'){
  if(records[symbol]?.status==='classified'){issues.push({symbol,reason:'stock source conflicts with ETP master'});records[symbol]={...records[symbol],status:'conflict'};}
  else records[symbol]={name:masterNames[symbol]?.name??symbol,status:'etp',source:'kis'};
 }else if(['warrant','unit','debt','preferred'].includes(type)&&!records[symbol])records[symbol]={name:masterNames[symbol]?.name??symbol,status:'instrument',securityType:type,source:'kis'};
}
const uniqueExamples=members=>{const names=new Set();return members.filter(c=>{const name=c.name.trim().toLowerCase();if(records[c.symbol].listingNote||names.has(name))return false;names.add(name);return true;}).slice(0,3);};
const registry=[...groups.values()].map(({companies,...g})=>{const members=[...companies.values()].filter(c=>records[c.symbol]?.status==='classified').sort((a,b)=>g.market==='us'?(b.marketCap??0)-(a.marketCap??0)||a.symbol.localeCompare(b.symbol):a.name.localeCompare(b.name,'ko'));return {...g,count:members.length,examples:uniqueExamples(members)};}).filter(g=>g.count>0);
const sources={us:{name:'Stock Analysis',url:'https://stockanalysis.com/stocks/screener/',checkedAt:now},kr:{name:'한국거래소 KIND',url:urls.kr,checkedAt:now},kis:{name:'한국투자증권 종목 마스터',url:'https://github.com/koreainvestment/open-trading-api/tree/main/stocks_info',checkedAt:now}};
const snapshot={version:1,checkedAt:now,sources,records,assetTypes,issues};
// Reject a sudden coverage drop before touching either checked-in snapshot.
let previous;
try { previous=JSON.parse(await readFile(join(out,'industry-catalog.json'),'utf8')); }
catch(error) { if(error.code!=='ENOENT')throw error; }
if(previous){
 for(const market of ['us','kr']){
  const count=data=>Object.values(data).filter(r=>r.source===market&&r.status==='classified').length;
  if(count(records)<count(previous.records)*0.8)throw Error('Classification coverage dropped by more than 20%: '+market);
 }
}

await mkdir(out,{recursive:true});
for(const [filename,value] of [['industry-catalog.json',snapshot],['industry-registry.json',{version:1,checkedAt:now,sources,industries:registry}]]){const target=join(out,filename);await writeFile(target+'.tmp',JSON.stringify(value));}
for(const filename of ['industry-catalog.json','industry-registry.json'])await rename(join(out,filename+'.tmp'),join(out,filename));
console.log(JSON.stringify({industries:registry.length,sourceRows:{us:us.rows.length,kr:kr.length},records:Object.keys(records).length,statuses:Object.values(records).reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),issues:issues.length}));
