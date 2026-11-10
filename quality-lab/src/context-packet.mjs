import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DATA, writeJson } from './store.mjs';

export const CONTEXT_COMPILER = '0.1.0';
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function sourceText(html) {
  return html.replace(/<!--[^]*?-->/g,' ').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,hex,dec)=> {
      const n=parseInt(hex||dec,hex?16:10);return n<=0x10ffff?String.fromCodePoint(n):' ';
    }).replace(/&(nbsp|amp|quot|apos|lt|gt);/g,(_,name)=>({nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[name]))
    .replace(/\s+/g,' ').trim();
}
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,max=1000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const day=date=>new Date(date).toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});

/** Evidence-bound draft, NOT semantic approval. Every run remains a candidate. */
export function compileContext(draft,html,{now=Date.now()}={}) {
  requireValue(text(html,2_000_000),'source_size');
  requireValue(draft?.schemaVersion===1&&draft.status==='candidate','candidate_only');
  requireValue(/^[A-Z0-9.^-]{1,20}$/.test(draft.symbol)&&/^\d{1,10}$/.test(draft.issuerId),'issuer_identity');
  const url=new URL(draft.source.url);
  requireValue(url.origin==='https://www.sec.gov'&&!url.search&&!url.hash
    &&url.pathname.startsWith(`/Archives/edgar/data/${Number(draft.issuerId)}/`),'source_identity');
  requireValue(text(draft.id,100)&&text(draft.issuerName,180)&&text(draft.source.label,120)&&text(draft.source.documentId,100),'metadata');
  requireValue(url.pathname.includes(draft.source.documentId),'document_identity');
  const raw=sourceText(html), lower=raw.toLowerCase();
  requireValue(lower.includes(draft.issuerName.toLowerCase())&&new RegExp(`\\b${draft.symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(raw),'issuer_not_in_source');
  requireValue(draft.event?.kind==='equity-financing'&&draft.event.phase==='terminated','unsupported_event');
  requireValue(text(draft.event.counterparty,160)&&raw.includes(draft.event.counterparty),'counterparty_not_in_source');
  for(const date of [draft.source.publishedAt,draft.source.checkedAt,draft.event.effectiveDate,draft.validUntil])requireValue(typeof date==='string'&&Number.isFinite(Date.parse(date)),'invalid_date');
  requireValue(Date.parse(draft.source.checkedAt)<=now+60_000&&Date.parse(draft.source.publishedAt)<=now+60_000,'future_source');
  requireValue(Date.parse(draft.event.effectiveDate)<=Date.parse(draft.source.publishedAt),'event_after_filing');
  requireValue(Date.parse(draft.validUntil)>now&&Date.parse(draft.validUntil)<=Date.parse(draft.source.publishedAt)+10*86400000,'invalid_expiry');
  requireValue(raw.includes(day(draft.event.effectiveDate))&&raw.includes(day(draft.source.publishedAt)),'date_not_in_source');
  requireValue(/terminated the Common Stock Purchase Agreement/i.test(raw)&&/newly issued shares/i.test(raw),'event_not_in_source');
  requireValue(text(draft.title,180)&&text(draft.summary)&&text(draft.watch),'copy_invalid');
  requireValue(Array.isArray(draft.facts)&&draft.facts.length>=3&&draft.facts.length<=10,'facts_required');
  const facts=new Map();
  for(const fact of draft.facts) {
    requireValue(text(fact.id,60)&&!facts.has(fact.id)&&text(fact.quote,1600),'fact_invalid');
    const quote=sourceText(fact.quote),offset=raw.indexOf(quote);
    requireValue(quote.length>=25&&offset>=0,'quote_not_in_source');
    facts.set(fact.id,{...fact,quote,offset});
  }
  const refs=ids=>Array.isArray(ids)&&ids.length>0&&ids.every(id=>facts.has(id));
  requireValue(refs(draft.summaryFacts)&&refs(draft.watchFacts),'copy_facts_required');
  requireValue(Array.isArray(draft.questions)&&draft.questions.length>=1&&draft.questions.length<=3,'question_count');
  const ids=new Set();
  for(const q of draft.questions){requireValue(text(q.id,60)&&!ids.has(q.id)&&text(q.title,180)&&text(q.answer)&&refs(q.sourceFacts),'question_evidence');ids.add(q.id);}
  // Projection deliberately excludes raw document and source quotes.
  const body={schemaVersion:1,id:draft.id,status:'candidate',symbol:draft.symbol,issuerId:draft.issuerId,
    source:{url:url.href,label:draft.source.label,documentId:draft.source.documentId,contentHash:hash(html),publishedAt:draft.source.publishedAt,checkedAt:draft.source.checkedAt},
    event:{...draft.event},title:draft.title,summary:draft.summary,questions:draft.questions.map(({id,title,answer,sourceFacts})=>({id,title,answer,sourceFacts})),watch:draft.watch,validUntil:draft.validUntil};
  return {compiler:CONTEXT_COMPILER,createdAt:new Date(now).toISOString(),status:'candidate',
    checks:{issuerAndDateMatch:true,quotesLocated:true,semanticReview:'pending',publication:'blocked'},
    draftHash:hash(draft),facts:[...facts.values()],summaryFacts:draft.summaryFacts,watchFacts:draft.watchFacts,
    packet:{...body,version:hash(body)}};
}

/** Explicit local artifact export; it has no network/database/publication credentials. */
export async function exportContextPreview(draftFile,sourceFile,output,{dataRoot=DATA,now=Date.now()}={}) {
  requireValue(path.basename(output)==='stock-context-preview.json','preview_filename_required');
  const draft=JSON.parse(await fs.readFile(draftFile,'utf8')),html=await fs.readFile(sourceFile,'utf8');
  const result=compileContext(draft,html,{now});
  const artifact=path.join(dataRoot,'contexts',result.packet.version+'.json');
  try {await writeJson(artifact,result,{exclusive:true});}
  catch(e){if(e.code!=='EEXIST')throw e;const prior=JSON.parse(await fs.readFile(artifact,'utf8'));requireValue(prior.draftHash===result.draftHash&&hash(prior.packet)===hash(result.packet),'immutable_collision');}
  // Atomic replacement: a bad draft never overwrites the last usable preview.
  await writeJson(output,{schemaVersion:1,packets:[result.packet]});
  return {version:result.packet.version,artifact,output,status:'candidate',semanticReview:'pending'};
}

export async function listContextCandidates({dataRoot=DATA}={}) {
  const dir=path.join(dataRoot,'contexts');
  let names;try{names=await fs.readdir(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}
  return Promise.all(names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).sort().map(async name=>{
    const item=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));
    const {version,...body}=item.packet;
    requireValue(item.status==='candidate'&&body.status==='candidate'&&version===name.slice(0,-5)&&hash(body)===version,'candidate_integrity');
    const url=new URL(body.source.url);
    requireValue(url.origin==='https://www.sec.gov'&&url.pathname.startsWith(`/Archives/edgar/data/${Number(body.issuerId)}/`),'source_identity');
    return item;
  }));
}
