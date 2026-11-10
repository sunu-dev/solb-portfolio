import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const evidence=JSON.parse(await readFile(process.argv[2] || new URL('sources/etfs/reviewed-evidence.json',root),'utf8'));
const editorial=(await readFile(new URL('sources/etfs/explanations.tsv',root),'utf8')).split('\n').filter(line=>line && !line.startsWith('#')).map(line=>line.split('|'));
const multiples={TQQQ:3,SQQQ:-3,SOXL:3,SOXS:-3,UPRO:3,SPXU:-3,QLD:2,QID:-2,TNA:3,TZA:-3,TMF:3,TMV:-3,KORU:3};
const evidenceBySymbol=new Map(evidence.records.map(row=>[row.symbol,row]));
const issuerOverrides=JSON.parse(await readFile(new URL('sources/etfs/issuer-overrides.json',root),'utf8'));
if(editorial.length!==300 || new Set(editorial.map(row=>row[0])).size!==300) throw Error('Expected 300 unique editorial records');
const records=editorial.map(([symbol,kind,target])=>{
  const source=evidenceBySymbol.get(symbol);
  if(!source || !target || (kind==='leverage' && !multiples[symbol])) throw Error('Missing evidence: '+symbol);
  const issuerUrl=issuerOverrides[symbol] ?? source.issuerUrl.replace(/^http:/,'https:');
  return {symbol,name:source.n,kind,target,...(multiples[symbol]?{multiple:multiples[symbol]}:{}),sourceUrl:source.url,issuerUrl,checkedAt:source.checkedAt.slice(0,10)};
});
await writeFile(new URL('src/data/etf-explanations.json',root),JSON.stringify({version:1,selection:'편집 선정 100개와 자산 규모 상위 상품을 합친 미국 상장 ETF·상장상품 300개. 인기·거래량 순위가 아니에요.',selectedAt:evidence.capturedAt,records},null,2)+'\n');
console.log(JSON.stringify({records:records.length,types:new Set(records.map(row=>row.kind)).size}));
