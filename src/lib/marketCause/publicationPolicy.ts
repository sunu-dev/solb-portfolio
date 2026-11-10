import { checkCandidate, comparableFacts, documentReasons } from './validateClaims';
import { compareDecimal, digest, documentHash, hasValidProvenance, instant } from './normalizeFacts';
import type { Candidate, Context, NormalizedFact, PublicationDecision, SourceDocument } from './types';

export const POLICY_VERSION = 'market-cause-evidence-v1';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_./-]{1,160}$/.test(v);
/** Models may select references, but cannot provide approved facts, prose, checks or URLs. */
export function parseCandidate(value: unknown): Candidate | null {
  if (!record(value) || !id(value.id)) return null;
  const keys = Object.keys(value).sort().join(',');
  if (value.kind === 'fact' && keys === 'factId,id,kind' && id(value.factId)) return value as unknown as Candidate;
  if (value.kind === 'versus_consensus' && keys === 'actualId,expectedId,id,kind' && id(value.actualId) && id(value.expectedId)) return value as unknown as Candidate;
  if (value.kind === 'mechanism' && keys === 'factIds,id,kind,rule' && value.rule === 'capital_spending_cash'
    && Array.isArray(value.factIds) && value.factIds.length === 1 && value.factIds.every(id)) return value as unknown as Candidate;
  return null;
}
export function evaluatePublication(input: {
  context: Context; documents: SourceDocument[]; facts: NormalizedFact[]; candidates: unknown[];
  previousDocumentIds?: string[];
}): PublicationDecision {
  const { context, documents, facts, candidates } = input;
  const inputHash = digest([POLICY_VERSION, context, documents, facts, candidates, input.previousDocumentIds ?? []]);
  const result: PublicationDecision = { disposition:'facts_only', claims:[], rejected:[], reasonCodes:[], inputHash, policyVersion:POLICY_VERSION };
  if (!Number.isFinite(instant(context.asOf)) || !Number.isFinite(instant(context.windowStart))
    || instant(context.windowStart) > instant(context.asOf) || !context.entityIds.length
    || documents.length > 100 || facts.length > 500 || candidates.length > 100) {
    result.reasonCodes.push('invalid_or_excessive_input'); return result;
  }
  const docs = new Map(documents.map(doc=>[doc.id,doc])); const factMap = new Map(facts.map(fact=>[fact.id,fact]));
  if (docs.size !== documents.length || factMap.size !== facts.length) { result.reasonCodes.push('duplicate_evidence_id'); return result; }
  if (input.previousDocumentIds?.some(key=> {
    const doc=docs.get(key);
    return !doc || documentReasons(doc,context).length>0 || doc.hash!==documentHash(doc.cells);
  })) {
    result.disposition = 'withdrawn'; result.reasonCodes.push('previous_evidence_unavailable'); return result;
  }
  // Remove contradictory facts and all dependent candidates, never choose a convenient source.
  const valid = facts.filter(f=>docs.has(f.documentId) && !documentReasons(docs.get(f.documentId)!,context).length
    && hasValidProvenance(f,docs.get(f.documentId)!));
  const conflicting = new Set<string>();
  for(let i=0;i<valid.length;i++) for(let j=i+1;j<valid.length;j++) {
    const a=valid[i],b=valid[j];
    if(a.role===b.role && comparableFacts(a,b) && compareDecimal(a.value,b.value)!==0) { conflicting.add(a.id); conflicting.add(b.id); }
  }
  for(const key of conflicting) factMap.delete(key);
  if(conflicting.size) { result.disposition='conflicting'; result.reasonCodes.push('contradictory_facts'); }
  const parsed = candidates.map(parseCandidate); const ids=parsed.flatMap(c=>c?[c.id]:[]);
  if(new Set(ids).size!==ids.length) { result.reasonCodes.push('duplicate_claim_id');return result; }
  parsed.forEach((candidate,index)=>{
    if(!candidate) {result.rejected.push({id:`candidate:${index}`,reasons:['invalid_candidate_schema']});return;}
    const checked=checkCandidate(candidate,factMap,docs,context);
    if(checked.claim) result.claims.push(checked.claim);
    else result.rejected.push({id:candidate.id,reasons:checked.reasons});
  });
  // These deterministic templates establish facts and general mechanisms only.
  // Do not label them a verified explanation of the observed price movement.
  if(!result.reasonCodes.length) result.reasonCodes.push('price_attribution_not_verified');
  return result;
}
