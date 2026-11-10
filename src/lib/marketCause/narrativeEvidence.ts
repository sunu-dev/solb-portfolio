import { digest, documentHash, instant } from './normalizeFacts';
import { documentReasons } from './validateClaims';
import { reconcileDocuments } from './documentStore';
import type {Context,SourceDocument} from './types';
export interface NarrativeDocument extends SourceDocument {
 sourceId:'sec-narrative';entityId:string;accession:string;
}
export interface Passage {documentId:string;locator:string;text:string;hash:string;entityId:string;publishedAt:string;}
/** A later changed body at the same official URL invalidates the previous version.
 * Missing fetches and late deliveries do not erase or resurrect evidence. */
export function reconcileNarratives(previous:NarrativeDocument[],incoming:NarrativeDocument[]):NarrativeDocument[]{
 const older=previous.map(doc=>({...doc}));
 for(const next of incoming){
  const sameId=previous.find(d=>d.id===next.id);
  if(sameId&&(sameId.entityId!==next.entityId||sameId.accession!==next.accession))throw new Error('immutable_narrative_identity');
  if(sameId)continue;
  for(const old of older)if(old.url===next.url&&old.id!==next.id&&old.status==='active'
    &&instant(next.retrievedAt)>=instant(old.retrievedAt))old.status='superseded';
 }
 return reconcileDocuments(older,incoming) as NarrativeDocument[];
}
/** Bounded text extraction, NOT a financial table/number parser. HTML is never rendered.
 * Tables, scripts, styling and hidden XBRL facts are excluded. Only visible prose
 * is eligible for model review; the original HTML hash is retained separately.
 */
export function extractProse(html:string,maxBytes=2_000_000,minChars=80,maxParagraphs=400):string[] {
 if(!Number.isInteger(minChars)||minChars<1||minChars>80||!Number.isInteger(maxParagraphs)||maxParagraphs<1||maxParagraphs>2500||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>10_000_000||Buffer.byteLength(html,'utf8')>maxBytes)throw new Error('narrative_size_limit');
 const cleaned=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style|ix:hidden)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
 let table=0;let text='';const paragraphs:string[]=[];const hidden:string[]=[];
 const flush=()=>{const value=decode(text).replace(/\s+/g,' ').trim();text='';if(value.length>=minChars&&value.length<=3000)paragraphs.push(value);};
 // Conservative extraction: reject incomplete markup, don't interpret unknown entities.
 for(const token of cleaned.match(/<[^>]*>|[^<]+/g)??[]) {
  if(token.startsWith('<')) {
   const close=token.match(/^<\/([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
   const open=token.match(/^<([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
   if(hidden.length){if(close===hidden.at(-1))hidden.pop();else if(open&&open===hidden.at(-1)&&!token.endsWith('/>'))hidden.push(open);continue;}
   if(open && /(?:\shidden(?:\s|=|>)|aria-hidden\s*=\s*["']true["']|display\s*:\s*none|visibility\s*:\s*hidden)/i.test(token)){if(!token.endsWith('/>')&&!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(open))hidden.push(open);continue;}
   if(/^<table\b/i.test(token)){if(table===0)flush();table++;}
   else if(/^<\/table\b/i.test(token)){table=Math.max(0,table-1);}
   else if(table===0&&/^<\/?(?:p|div|h[1-6]|br|li)\b/i.test(token))flush();
  }else if(table===0&&!hidden.length)text+=token;
 }
 flush();
 return (minChars<80?paragraphs:[...new Set(paragraphs)]).slice(0,maxParagraphs);
}
function decode(text:string):string {
 const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
 return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(original,key:string)=>{
  if(key.startsWith('#')){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
   return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' ';}
  return named[key]??original;
 });
}
export function makeNarrative(input:{cik:string;accession:string;url:string;html:string;publishedAt:string;retrievedAt:string}):NarrativeDocument {
 if(!/^\d{10}$/.test(input.cik)||!/^\d{10}-\d{2}-\d{6}$/.test(input.accession))throw new Error('invalid_narrative_identity');
 const prefix=`https://www.sec.gov/Archives/edgar/data/${Number(input.cik)}/${input.accession.replace(/-/g,'')}/`;
 if(!input.url.startsWith(prefix)||!/^[-a-zA-Z0-9_.]+\.html?$/.test(input.url.slice(prefix.length)))throw new Error('invalid_narrative_url');
 if(!Number.isFinite(instant(input.publishedAt))||!Number.isFinite(instant(input.retrievedAt))||instant(input.publishedAt)>instant(input.retrievedAt))throw new Error('invalid_narrative_time');
 const prose=extractProse(input.html);if(!prose.length)throw new Error('no_visible_narrative');
 const cells=Object.fromEntries(prose.map((p,i)=>[`paragraph:${i}`,p]));cells.htmlHash=digest(input.html);
 const hash=documentHash(cells);
 return {id:`sec-prose:${digest([input.url,hash])}`,sourceId:'sec-narrative',entityId:`CIK${input.cik}`,accession:input.accession,url:input.url,
  hash,cells,publishedAt:input.publishedAt,precision:'instant',firstSeenAt:input.retrievedAt,retrievedAt:input.retrievedAt,status:'active'};
}
export function eligiblePassages(documents:NarrativeDocument[],context:Context):Passage[] {
 const seen=new Set<string>();const passages:Passage[]=[];
 for(const doc of documents){
  if(seen.has(doc.id))throw new Error('duplicate_narrative');seen.add(doc.id);
  if(doc.sourceId!=='sec-narrative'||documentReasons(doc,context).length||doc.hash!==documentHash(doc.cells)
    ||!context.entityIds.includes(doc.entityId)||doc.precision!=='instant'||instant(doc.publishedAt!)<instant(context.windowStart))continue;
  for(const [locator,text] of Object.entries(doc.cells).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})))if(/^paragraph:\d+$/.test(locator)&&text.length>=80&&text.length<=3000)
   passages.push({documentId:doc.id,locator,text,hash:digest(text),entityId:doc.entityId,publishedAt:doc.publishedAt!});
 }
 return passages;
}
