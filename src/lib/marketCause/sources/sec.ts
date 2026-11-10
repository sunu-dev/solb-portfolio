import { digest, documentHash, instant, normalizeFact, validDay } from '../normalizeFacts';
import type { Metric, NormalizedFact, SourceDocument, Unit } from '../types';

/** Registered taxonomy only: an LLM cannot invent a financial tag or unit mapping. */
export const SEC_CONCEPTS = {
  Revenues: {metric:'revenue',unit:'USD'},
  RevenueFromContractWithCustomerExcludingAssessedTax: {metric:'revenue',unit:'USD'},
  NetIncomeLoss: {metric:'net_income',unit:'USD'},
  NetCashProvidedByUsedInOperatingActivities: {metric:'operating_cash_flow',unit:'USD'},
  PaymentsToAcquirePropertyPlantAndEquipment: {metric:'capital_expenditure',unit:'USD'},
  EarningsPerShareDiluted: {metric:'eps',unit:'USD/share'},
} as const satisfies Record<string,{metric:Metric;unit:Unit}>;
export type SecConcept = keyof typeof SEC_CONCEPTS;
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function conceptUrl(cik: string, concept: SecConcept): string {
  if(!/^\d{10}$/.test(cik)||!Object.hasOwn(SEC_CONCEPTS,concept)) throw new Error('unregistered_sec_request');
  return `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`;
}
export interface SecFiling { accession:string; acceptedAt:string; filed:string; form:string; }
export function parseSecFilings(value:unknown,cik:string):SecFiling[] {
  if(!rec(value)||String(value.cik).padStart(10,'0')!==cik||!rec(value.filings)||!rec(value.filings.recent)) throw new Error('invalid_sec_identity');
  const recent=value.filings.recent; const fields=['accessionNumber','acceptanceDateTime','filingDate','form'];
  if(!fields.every(k=>Array.isArray(recent[k])) || fields.some(k=>(recent[k] as unknown[]).length!==(recent.accessionNumber as unknown[]).length)) throw new Error('invalid_sec_columns');
  const accessions=recent.accessionNumber as unknown[];
  if(accessions.length>10000) throw new Error('sec_filing_limit');
  const seen=new Set<string>();const output:SecFiling[]=[];
  for(let i=0;i<accessions.length;i++) {
    const accession=accessions[i];const acceptedAt=(recent.acceptanceDateTime as unknown[])[i];
    const filed=(recent.filingDate as unknown[])[i];const form=(recent.form as unknown[])[i];
    if(typeof accession!=='string'||!/^\d{10}-\d{2}-\d{6}$/.test(accession)||seen.has(accession)
      ||typeof acceptedAt!=='string'||!Number.isFinite(instant(acceptedAt))||typeof filed!=='string'||!validDay(filed)
      ||typeof form!=='string') throw new Error('invalid_sec_filing');
    seen.add(accession);output.push({accession,acceptedAt,filed,form});
  }
  return output;
}
/** SEC values are structured facts, not forecasts/consensus and not price explanations.
 * We retain exact fiscal start/end; fp/frame are never used to relabel YTD as a quarter.
 */
export function extractSecConcept(input:{body:unknown;cik:string;concept:SecConcept;filings:SecFiling[];firstSeenAt:string;retrievedAt:string}): {
  documents:SourceDocument[];facts:NormalizedFact[];rejected:number;
} {
  const {body,cik,concept,filings,firstSeenAt,retrievedAt}=input;
  const url=conceptUrl(cik,concept);const mapping=SEC_CONCEPTS[concept];
  if(!rec(body)||String(body.cik).padStart(10,'0')!==cik||body.taxonomy!=='us-gaap'||body.tag!==concept||!rec(body.units)) throw new Error('invalid_sec_concept');
  if(!Number.isFinite(instant(firstSeenAt))||!Number.isFinite(instant(retrievedAt))||instant(firstSeenAt)>instant(retrievedAt)) throw new Error('invalid_fetch_time');
  const sourceUnit=mapping.unit==='USD/share'?'USD/shares':mapping.unit;
  const rows=body.units[sourceUnit]; if(!Array.isArray(rows)||rows.length>20000) throw new Error('invalid_sec_units');
  const byAccession=new Map(filings.map(f=>[f.accession,f]));
  if(byAccession.size!==filings.length) throw new Error('duplicate_sec_filing');
  const documents:SourceDocument[]=[];const facts:NormalizedFact[]=[];let rejected=0;
  const seen=new Set<string>();
  rows.forEach(row=>{
    if(!rec(row)||typeof row.accn!=='string'||typeof row.start!=='string'||!validDay(row.start)
      ||typeof row.end!=='string'||!validDay(row.end)||row.start>row.end
      ||typeof row.val!=='number'||!Number.isFinite(row.val)||Math.abs(row.val)>Number.MAX_SAFE_INTEGER
      ||!['10-Q','10-K','10-Q/A','10-K/A','8-K','8-K/A','20-F','20-F/A','6-K','6-K/A'].includes(String(row.form))) {rejected++;return;}
    const filing=byAccession.get(row.accn);
    if(!filing||row.filed!==filing.filed||row.form!==filing.form||instant(filing.acceptedAt)>instant(firstSeenAt)) {rejected++;return;}
    const raw=String(row.val); if(!/^-?\d+(?:\.\d+)?$/.test(raw)) {rejected++;return;}
    const key=digest(['sec-fact-v2',cik,concept,row.accn,row.start,row.end,sourceUnit,raw]);
    if(seen.has(key))return;seen.add(key);
    const cells={value:raw,accession:row.accn,start:row.start,end:row.end,unit:sourceUnit,tag:concept};
    const doc:SourceDocument={id:`sec:${key}`,sourceId:'sec-companyconcept',url,hash:documentHash(cells),
      publishedAt:filing.acceptedAt,precision:'instant',firstSeenAt,retrievedAt,status:'active',cells};
    // Distinct taxonomy concepts deliberately have distinct definitions. No silent alias merging.
    try { const fact=normalizeFact({id:`fact:${key}`,documentId:doc.id,locator:'value',entityId:`CIK${cik}`,
      metric:mapping.metric,unit:mapping.unit,rawValue:raw,scale:0,periodStart:row.start,periodEnd:row.end,
      basis:'gaap',role:'actual',scope:'consolidated',definition:`us-gaap:${concept}`},doc);
      documents.push(doc);facts.push(fact);
    } catch {rejected++;}
  });
  return {documents,facts,rejected};
}
