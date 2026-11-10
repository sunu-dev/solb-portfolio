import { fetchSecJson } from './secTransport';
import { parseSecFilings } from './sec';
import { instant } from '../normalizeFacts';
import { makeNarrative,type NarrativeDocument } from '../narrativeEvidence';
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
async function archive(url:string,userAgent:string,transport:typeof fetch):Promise<string>{
 const r=await transport(url,{redirect:'error',cache:'no-store',headers:{'User-Agent':userAgent,Accept:'text/html,application/json'},signal:AbortSignal.timeout(10000)});
 if(!r.ok||r.redirected||r.url&&r.url!==url)throw new Error(`sec_archive_status_${r.status}`);
 if(!/text\/html|application\/json/i.test(r.headers.get('content-type')??''))throw new Error('sec_archive_type');
 const reader=r.body?.getReader();if(!reader)throw new Error('sec_archive_empty');let bytes=0;const chunks:Uint8Array[]=[];
 try{for(;;){const p=await reader.read();if(p.done)break;bytes+=p.value.byteLength;if(bytes>2_000_000)throw new Error('sec_archive_limit');chunks.push(p.value);}}
 finally{await reader.cancel();reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
/** Discovery uses registered SEC filings/indexes only, never an AI-selected URL. */
export async function collectSecNarratives(input:{cik:string;symbol:string;userAgent:string;now?:()=>string;transport?:typeof fetch}):Promise<NarrativeDocument[]>{
 const transport=input.transport??fetch;const clock=input.now??(()=>new Date().toISOString());
 const metadata=await fetchSecJson({cik:input.cik},input.userAgent,transport);
 if(!rec(metadata)||!Array.isArray(metadata.tickers)||!metadata.tickers.includes(input.symbol))throw new Error('sec_symbol_mismatch');
 const filings=parseSecFilings(metadata,input.cik);const now=instant(clock());if(!Number.isFinite(now))throw new Error('invalid_collection_time');
 const recent=filings.filter(f=>/^8-K(?:\/A)?$/.test(f.form)&&instant(f.acceptedAt)<=now&&now-instant(f.acceptedAt)<7*86400000).slice(0,2);
 const documents:NarrativeDocument[]=[];
 for(const filing of recent){
  const prefix=`https://www.sec.gov/Archives/edgar/data/${Number(input.cik)}/${filing.accession.replace(/-/g,'')}/`;
  await new Promise(r=>setTimeout(r,1100));const index=JSON.parse(await archive(prefix+'index.json',input.userAgent,transport)) as unknown;
  if(!rec(index)||!rec(index.directory)||!Array.isArray(index.directory.item))throw new Error('invalid_sec_index');
  const available=new Set(index.directory.item.filter(rec).map(v=>v.name).filter((n):n is string=>typeof n==='string'&&/^[a-zA-Z0-9_.-]+\.html?$/.test(n)));
  await new Promise(r=>setTimeout(r,1100));
  const filingIndex=await archive(prefix+filing.accession+'-index.html',input.userAgent,transport);
  const names=exhibitNames(filingIndex,prefix,available);

  for(const name of names){await new Promise(r=>setTimeout(r,1100));const url=prefix+name;const html=await archive(url,input.userAgent,transport);
   documents.push(makeNarrative({cik:input.cik,accession:filing.accession,url,html,publishedAt:filing.acceptedAt,retrievedAt:clock()}));}
 }
 return documents;
}

/** Select exhibit type from SEC's filing index, not guessed filename conventions. */
export function exhibitNames(indexHtml:string,prefix:string,available:Set<string>):string[]{
 const found:string[]=[];
 for(const row of indexHtml.match(/<tr\b[^>]*>[^]*?<\/tr\s*>/gi)??[]){
  if(!/<td\b[^>]*>\s*EX-99(?:\.\d+)?\s*<\/td>/i.test(row))continue;
  for(const match of row.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
   try{const url=new URL(match[1],prefix).href;if(!url.startsWith(prefix))continue;
    const name=url.slice(prefix.length);if(available.has(name)&&!found.includes(name))found.push(name);
   }catch{ /* malformed source link is not eligible */ }
  }
 }
 return found.slice(0,2);
}
