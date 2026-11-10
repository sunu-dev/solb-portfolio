import { extractSecConcept, parseSecFilings, type SecConcept } from './sec';
import { fetchSecJson } from './secTransport';
import type { SourceDocument, NormalizedFact } from '../types';
import { instant } from '../normalizeFacts';

/** Read-only acquisition. No LLM, database writes or user portfolio input.
 * Callers must coordinate source-wide scheduling; this loop is deliberately serial.
 */
export async function collectSecEvidence(input:{cik:string;userAgent:string;concepts:SecConcept[];now?:()=>string;transport?:typeof fetch}) {
  if(!input.concepts.length||input.concepts.length>4||new Set(input.concepts).size!==input.concepts.length) throw new Error('sec_concept_limit');
  const clock=input.now??(()=>new Date().toISOString());
  const filings=parseSecFilings(await fetchSecJson({cik:input.cik},input.userAgent,input.transport),input.cik);
  const documents:SourceDocument[]=[];const facts:NormalizedFact[]=[];const failures:string[]=[];let rejected=0;
  for(const concept of input.concepts) {
    // Under the source's shared rate ceiling even in this one-shot read-only tool.
    await new Promise(resolve=>setTimeout(resolve,1100));
    try {
      const body=await fetchSecJson({cik:input.cik,concept},input.userAgent,input.transport);const fetched=clock();
      if(!Number.isFinite(instant(fetched)))throw new Error('invalid_collection_clock');
      const selected=filings.filter(f=>instant(f.acceptedAt)<=instant(fetched) && instant(fetched)-instant(f.acceptedAt)<7*86400000);
      const result=extractSecConcept({body,cik:input.cik,concept,filings:selected,firstSeenAt:fetched,retrievedAt:fetched});
      documents.push(...result.documents);facts.push(...result.facts);rejected+=result.rejected;
    } catch {failures.push(concept);}
  }
  return {documents,facts,failures,rejected};
}
